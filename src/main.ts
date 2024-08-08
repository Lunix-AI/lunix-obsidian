// noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols

import type { CompletionClientGetCompletionParams } from "@lunix-ai/core-shared/src/models/client/completionClientGetCompletionParams";
import type { CompletionClientTool } from "@lunix-ai/core-shared/src/models/client/completionClientTool";
import {
	ContentPartType,
	MessagePartRole,
	type RequestContentItem,
	type RequestPart,
	type ToolCallsContentPart,
} from "@lunix-ai/core-shared/src/models/data/completionRequest";
import { WebSocketCompletionClient } from "@lunix-ai/model-clients.websocket/src/webSocketCompletionClient";
import type { ClaudeCompletionServerConfig } from "@lunix-ai/models.claude/src/model-claude";
import * as JSON5 from "json5";
import { around } from "monkey-around";
import {
	type App,
	type Component,
	type EventRef,
	ItemView,
	type MarkdownPostProcessor,
	MarkdownRenderer,
	type Menu,
	type MenuItem,
	Notice,
	Plugin,
	PluginSettingTab,
	type Point,
	Setting,
	type Workspace,
	setIcon,
	setTooltip,
} from "obsidian";
import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import type { PerformAICompletionParams } from "~/ai/performAICompletionParams";
import {
	type CanvasEventTypes,
	canvasEvents,
	canvasLoaded,
	extendCanvas,
} from "~/canvas";
import { getTokens } from "~/getTokens";
import type { LunixSettings } from "~/lunixSettings";
import { previewToolCalls } from "~/previewToolCalls";
import {
	type ArtifactBlock,
	type ArtifactMetaBlock,
	processArtifactBlocks,
	replaceBlocks,
} from "~/processArtifacts";
import {
	defaultSystemPrompt,
	toolsPrompt,
} from "~/prompts/defaultSystemPrompt";
import { SampleModal } from "~/sampleModal";
import { DEFAULT_SETTINGS } from "~/settings/DEFAULT_SETTINGS";
import {
	type Canvas,
	type CanvasFileNode,
	type CanvasTextNode,
	ResetSymbol,
} from "~/shared/types";
import { streamObject } from "~/streamObject";
import { allTools } from "~/tools/allTools";
import ArtifactFrame from "~/tools/artifacts/ArtifactFrame";
import { checkToolCall } from "~/tools/checkToolCall";
import { CanvasItemColor, tryAddNeighbour } from "~/tryAddNeighbour";
import type {
	AIEnabledNodeData,
	ArtifactNodeData,
	LunixNodeData,
} from "~/types/LunixNodeData";
import type { CanvasView } from "~/types/canvasView";
import type {
	ChatCompletionCreateParamsStreaming,
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall,
	Choice,
	DeltaToolCall,
} from "~/types/openai";
import { getBasicFileInfo, getNodeText } from "~/ui/getNodeText";
import { getUserInput } from "~/ui/getUserInput";
import { getParent } from "~/utils/getParent";
import { isMainSelection } from "~/utils/isMainSelection";

import process from "process";

if (!window.process) {
	// a workaround for Android which uses Capacitor and does not have a global process object, but it's necessary for some dependencies
	window.process = process;
}

declare module "obsidian" {
	interface MenuItem {
		dom: HTMLDivElement;
	}
}

const shouldDisableNodeEditing = (node: CanvasTextNode<LunixNodeData>) => {
	const data = node.getData();

	if (data) {
		if (
			data.metaType === "artifact" ||
			data.metaType === "additional-content"
		) {
			return true;
		}

		if (data.metaType === "ai-enabled") {
			const message = data.message;
			const role = message?.role;
			switch (role) {
				case "assistant":
				case "tool":
					return true;
			}
		}
	}

	return false;
};

export default class Lunix extends Plugin {
	settings: LunixSettings;

	copyCodeButtonMarkdownProcessor: MarkdownPostProcessor = (
		element,
		context,
	) => {
		const copyCodeButtons = Array.from(element.findAll(".copy-code-button"));

		for (const copyCodeButton of copyCodeButtons) {
			const parentElement = copyCodeButton.parentElement;
			if (!parentElement) {
				continue;
			}

			const info = context.getSectionInfo(parentElement);
			if (!info) {
				continue;
			}

			const relevantLines = info.text
				.split("\n")
				.slice(info.lineStart, info.lineEnd + 1);

			if (relevantLines.length < 3) {
				continue;
			}

			let extension = relevantLines[0].trim().replace("```", "");
			if (extension.length === 0 || extension === "plaintext") {
				extension = "txt";
			}

			// console.log('copyCodeButton', copyCodeButton);
			// add a new button to download the code in the code block, next to the copy button
			const downloadCodeButton = parentElement.createEl(
				"button",
				{
					cls: "download-code-button",
				},
				this.registerDomElement,
			);

			downloadCodeButton.setText(`Download .${extension}`);

			// set the icon of the download button
			setIcon(downloadCodeButton, "download");
			setTooltip(downloadCodeButton, "Download as file", {
				placement: "top",
			});

			// set the click event listener for the download button
			downloadCodeButton.addEventListener("click", async () => {
				// the relevant lines contain the ``` at the start and end, so we need to remove them
				const code = relevantLines.slice(1, -1).join("\n");

				const blob = new Blob([code], { type: "text/plain" });
				const url = URL.createObjectURL(blob);

				try {
					const a = document.createElement("a");
					a.download = `file.${extension}`;
					a.href = url;
					a.click();
				} finally {
					// remove the URL
					URL.revokeObjectURL(url);
				}
			});
		}
	};

	registerDomElement = (el: HTMLElement | null) => {
		if (!el) {
			return;
		}

		this.register(() => {
			if (el.isConnected) {
				el.remove();
			}
		});
	};

	nodeRender = async (
		node: CanvasTextNode<LunixNodeData> | CanvasFileNode<LunixNodeData>,
		retry = 3,
	) => {
		const nodeData = node.getData();
		const app = this.app;
		const contentEl = node.contentEl;
		const previewView: HTMLDivElement | null =
			contentEl?.querySelector("div.markdown-preview-view") ?? null;

		if (
			nodeData.metaType !== "artifact" &&
			nodeData.metaType !== "ai-enabled"
		) {
			return;
		}

		if (!previewView) {
			if (retry > 0) {
				let timeout = 50;
				switch (retry) {
					case 2:
						timeout = 100;
						break;
					case 1:
						timeout = 200;
						break;
				}
				await new Promise((resolve) => setTimeout(resolve, timeout));
				await this.nodeRender(node, retry - 1);
			} else {
				// console.error("Preview view not found.", {
				// 	node,
				// 	nodeData,
				// 	contentEl,
				// 	previewView,
				// });
			}
			return;
		}

		if (nodeData.metaType === "artifact") {
			this.renderArtifact(
				previewView,
				nodeData as ArtifactNodeData,
				node as CanvasTextNode<ArtifactNodeData>,
			);

			return;
		}

		await this.renderAIEnabledNode(
			node as CanvasTextNode<AIEnabledNodeData>,
			nodeData,
			previewView,
			app,
		);
	};

	renderAIEnabledNode = async (
		node: CanvasTextNode<AIEnabledNodeData>,
		nodeData: AIEnabledNodeData,
		previewView: HTMLDivElement,
		app: App,
	) => {
		const component = this as Component;

		await previewToolCalls(nodeData, previewView, app, component);

		const message = nodeData.message;
		if (!message) {
			return;
		}

		if (nodeData.metaType !== "ai-enabled") {
			node.setData({
				...node.getData(),
				metaType: "ai-enabled",
			});
		}

		const nodeEl = node.nodeEl;
		if (nodeEl) {
			// if container does not have a child with the class 'message-container' then let's add one
			const messageContainerEl =
				nodeEl.querySelector("div.chat-message-container") ??
				nodeEl.createDiv(
					{
						cls: "chat-message-container",
					},
					this.registerDomElement,
				);

			const messageEl =
				messageContainerEl.querySelector("div.chat-message") ??
				messageContainerEl.createDiv({
					cls: "chat-message",
				});

			const role = message.role;
			messageEl.setText(
				`Chat: ${role}${nodeData.finishReason ? ` (Finish: ${nodeData.finishReason})` : ""}.`,
			);

			if (role === "system") {
				const querySelector = nodeEl.querySelector(".functions-div");
				if (!querySelector) {
					const functions = nodeEl.createDiv(
						{
							cls: "functions-div",
						},
						this.registerDomElement,
					);

					const formContainer = functions.createDiv();

					// create a checkbox with a corresponding label to enable or disable functions
					// toggling the checkbox should update the data of the element
					// data.disableFunctions

					const checkBoxes = [
						["Disable Functions", "disableFunctions"],
						["Include Original", "includeOriginal"],
					] satisfies [
						label: string,
						key: keyof Pick<
							AIEnabledNodeData,
							"disableFunctions" | "includeOriginal"
						>,
					][];

					for (const [labelText, key] of checkBoxes) {
						const label = formContainer.createDiv().createEl("label");

						const checkbox = label.createEl("input", {
							type: "checkbox",
						});

						checkbox.checked = nodeData[key] ?? false;

						checkbox.addEventListener("change", () => {
							console.log(`Checkbox for ${key} changed.`, checkbox.checked);

							node.setData({
								...node.getData(),
								[key]: checkbox.checked,
							} satisfies AIEnabledNodeData);

							node.canvas.requestSave();
						});

						label.createSpan().setText(labelText);
					}
				}
			}
		}
	};

	private artifactRootMap = new Map<CanvasTextNode<ArtifactNodeData>, Root>();
	private onCanvasNodeRender = async (node: CanvasTextNode<LunixNodeData>) => {
		await this.nodeRender(node);
	};
	private onCanvasNodeMountContent = async (
		node: CanvasTextNode<LunixNodeData>,
	) => {
		await this.nodeRender(node);
	};

	private onCanvasNodeInitialize = async (
		node: CanvasTextNode<LunixNodeData>,
	) => {
		// console.log("Initializing node", node);
		// const data = node.getData();
		// if (data.type === "file") {
		// 	console.log("File node", data);
		// 	// const contents = await this.app.vault.cachedRead(node.getData().file);
		// 	// console.log("Contents", contents);
		//
		// 	const file = this.app.vault.getFileByPath(data.file);
		// 	console.log("File", file);
		// 	if (!file) {
		// 		return null;
		// 	}
		//
		// 	// const contents = await this.app.vault.cachedRead(file);
		// 	const fileInfo = await getBasicFileInfo<{
		// 		aiEnabled?: boolean;
		// 		role?: "user" | "system";
		// 		includeOriginal?: boolean;
		// 		disableFunctions?: boolean;
		// 	}>(this.app, file);
		// 	// console.log("Contents", fileInfo);
		//
		// 	const properties = fileInfo.properties;
		// 	if (properties.aiEnabled && node.getData().metaType !== "ai-enabled") {
		// 		const role: "user" | "system" = properties.role ?? "user";
		//
		// 		switch (role) {
		// 			case "system":
		// 				node.setData({
		// 					...node.getData(),
		// 					metaType: "ai-enabled",
		// 					message: {
		// 						role: "system",
		// 						content: fileInfo.contents,
		// 					} satisfies ChatCompletionMessageParam,
		// 					includeOriginal: properties.includeOriginal ?? false,
		// 					disableFunctions: properties.disableFunctions ?? false,
		// 				});
		// 				break;
		// 			case "user":
		// 				node.setData({
		// 					...node.getData(),
		// 					metaType: "ai-enabled",
		// 					message: {
		// 						role: "user",
		// 						content: fileInfo.contents,
		// 					} satisfies ChatCompletionMessageParam,
		// 				});
		// 				break;
		// 		}
		//
		// 		node.canvas.requestSave();
		// 	}
		// }
		//
		// await this.nodeRender(node);
	};

	// onCanvasNodeSetFile -> calls initialize
	private onCanvasNodeSetFile: CanvasEventTypes["canvas:node:setFile"] = async (
		node: CanvasFileNode<LunixNodeData>,
		_result,
		file,
	) => {
		const fileInfo = await getBasicFileInfo<{
			aiEnabled?: boolean;
			role?: "user" | "system";
			includeOriginal?: boolean;
			disableFunctions?: boolean;
		}>(this.app, file);

		const properties = fileInfo.properties;
		if (properties.aiEnabled && node.getData().metaType !== "ai-enabled") {
			const role: "user" | "system" = properties.role ?? "user";

			switch (role) {
				case "system":
					node.setData({
						...node.getData(),
						metaType: "ai-enabled",
						message: {
							role: "system",
							content: fileInfo.contents,
						} satisfies ChatCompletionMessageParam,
						includeOriginal: properties.includeOriginal ?? false,
						disableFunctions: properties.disableFunctions ?? false,
					});
					break;
				case "user":
					node.setData({
						...node.getData(),
						metaType: "ai-enabled",
						message: {
							role: "user",
							content: fileInfo.contents,
						} satisfies ChatCompletionMessageParam,
					});
					break;
			}

			node.canvas.requestSave();
		}

		await this.nodeRender(node);
	};

	private renderArtifact(
		previewView: Element,
		nodeData: ArtifactNodeData,
		node: CanvasTextNode<ArtifactNodeData>,
	) {
		// console.log("rendering", {
		// 	code: nodeData.src,
		// 	completed: nodeData.completed ?? false,
		// 	plugin: this,
		// 	app: this.app,
		// });

		if (previewView.querySelector(".lunix-artifact")) {
			const root = this.artifactRootMap.get(node);

			if (root) {
				root.render(
					createElement(ArtifactFrame, {
						code: nodeData.src,
						completed: nodeData.completed ?? false,
						plugin: this,
						app: this.app,
						node,
					}),
				);
			}

			return;
		}

		const root = previewView.createDiv({
			cls: "lunix-artifact",
			attr: {
				style: "width: 100%; height: 100%;",
			},
		});

		const reactRoot = createRoot(root);
		reactRoot.render(
			createElement(ArtifactFrame, {
				code: nodeData.src,
				plugin: this,
				app: this.app,
				completed: nodeData.completed ?? false,
				node,
			}),
		);

		this.artifactRootMap.set(node, reactRoot);

		let cleanedUp = false;
		const cleanup = () => {
			if (cleanedUp) {
				return;
			}
			cleanedUp = true;
			reactRoot.unmount();
			root.remove();
			this.artifactRootMap.delete(node);
		};

		node.child?.register(cleanup);
		this.register(cleanup);

		return;
	}

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("dice", "Lunix", () => {
			new SampleModal(this.app).open();
		});

		// patch JSON.parse, if it errors, do a console log
		// const originalJSONParse = JSON.parse;

		const uninstaller = around(JSON, {
			parse: (originalFunc) => {
				return function (this: typeof JSON, text: string) {
					try {
						return originalFunc.call(this, text);
					} catch (e) {
						try {
							return JSON5.parse(text);
						} catch (e2) {
							console.error("JSON parse error:", e, e2, text);
						}
						throw e;
					}
				};
			},
		});
		// JSON.parse = (text: string) => {
		// 	try {
		// 		return originalJSONParse(text);
		// 	} catch (e) {
		// 		console.error("JSON parse error:", e, text);
		// 		throw e;
		// 	}
		// };

		this.register(() => {
			// JSON.parse = originalJSONParse;
			uninstaller();
		});

		this.registerMarkdownPostProcessor(this.copyCodeButtonMarkdownProcessor);

		// // This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		new Notice("Loaded Lunix!");

		const workspace = this.app.workspace as Workspace & {
			on(
				name: "canvas:node-menu",
				callback: (menu: Menu, node: CanvasTextNode) => unknown,
				ctx?: unknown,
			): EventRef;
		};

		const interval = window.setInterval(() => {
			const canvasLeaf = workspace.getLeavesOfType("canvas")[0];
			if (canvasLeaf) {
				clearInterval(interval);

				const canvasView = canvasLeaf.view as CanvasView;

				const canvas = canvasView.canvas;
				extendCanvas({ canvas, plugin: this });

				this.register(() => {
					if (canvas[ResetSymbol]) {
						console.log("Resetting canvas");
						canvas[ResetSymbol]();
					}
				});

				for (const item of Array.from(canvas.nodes.values())) {
					this.nodeRender(item as CanvasTextNode<LunixNodeData>);
				}
			}
		}, 1000);

		this.registerInterval(interval);

		this.registerEvent(
			workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.view.getViewType() === "canvas") {
					const canvasView = leaf.view as CanvasView;

					const canvas = canvasView.canvas;
					extendCanvas({ canvas, plugin: this });

					this.register(() => {
						if (canvas[ResetSymbol]) {
							console.log("Resetting canvas.");
							canvas[ResetSymbol]();
						}
					});

					for (const item of Array.from(canvas.nodes.values())) {
						this.nodeRender(item as CanvasTextNode<LunixNodeData>);
					}
				}
			}),
		);

		// this.registerEvent(canvasEvents.on("canvas:nodeInteractionLayer:setTarget", (interactionLayer, _, a) => {
		// 	// console.log('Node interaction layer render...', interactionLayer);
		// }));

		this.registerEvent(
			canvasEvents.on("canvas:menu:render", (menu, _result) => {
				const canvasView = this.app.workspace.getActiveViewOfType(
					ItemView,
				) as CanvasView | null;

				if (!canvasView) {
					return;
				}

				const { canvas } = canvasView;

				if (!canvas || canvas.selection.size !== 1) {
					return;
				}

				const node = canvas.selection.values().next()
					.value as CanvasTextNode<AIEnabledNodeData>;

				const nodeData = node.getData();

				if (nodeData.type !== "file" && nodeData.type !== "text") {
					return;
				}

				if (menu.menuEl.querySelector(".gpt-menu-item")) return;

				const buttonEl_AIQuestions = menu.menuEl.createEl(
					"button",
					"clickable-icon gpt-menu-item ",
					this.registerDomElement,
				);

				setTooltip(buttonEl_AIQuestions, "AI", {
					placement: "top",
				});

				setIcon(buttonEl_AIQuestions, "lucide-flame");

				buttonEl_AIQuestions.addEventListener("pointerenter", async () => {
					const nodeData = node.getData();

					console.log("node", node, "data", nodeData, "canvas", canvas);
				});

				buttonEl_AIQuestions.addEventListener("click", async () => {
					await this.performAICompletion({
						app: this.app,
						canvas,
						node,
						mode: "user",
					});
				});
			}),
		);

		interface RoleConfig {
			title: string;
			role: "system" | "user" | "assistant"; // Add other roles as needed
			data?: Partial<LunixNodeData>;
		}

		const roles: RoleConfig[] = [
			{
				title: "Convert to System Prompt",
				role: "system",
				data: { includeOriginal: true },
			},
			{
				title: "Convert to User Message",
				role: "user",
				data: {},
			},
			// Add more roles as needed, e.g.:
			{
				title: "Convert to Assistant Response",
				role: "assistant",
				data: {},
			},
		];

		this.registerEvent(
			workspace.on(
				"canvas:node-menu",
				(menu, node: CanvasTextNode<LunixNodeData>) => {
					menu.addSeparator();

					for (const roleConfig of roles) {
						menu.addItem((item) => {
							this.registerDomElement(item.dom);

							item
								.setTitle(roleConfig.title)
								.onClick(async () => {
									const nodeData = node.getData();

									node.setData({
										...nodeData,
										metaType: "ai-enabled",
										message: {
											role: roleConfig.role,
											content: (await getNodeText(this.app, node)) ?? "",
										} satisfies ChatCompletionMessageParam,
										...roleConfig.data, // Spread additional data if provided
									});

									node.canvas.markDirty(node);
									await new Promise((resolve) => setTimeout(resolve, 50));
									node.render();
									await this.nodeRender(node);

									node.canvas.requestSave();
								})
								.setDisabled(node.getData().message?.role === roleConfig.role);
						});
					}

					menu.addSeparator();

					// add a toggle for 'alwaysKeepLoaded` property of the node
					menu.addItem((item) => {
						this.registerDomElement(item.dom);

						const alwaysKeepLoaded = node.alwaysKeepLoaded ?? false;

						item
							.setTitle("Toggle Always Keep Loaded")
							.setIcon(alwaysKeepLoaded ? "check" : "square")
							.onClick(async () => {
								node.alwaysKeepLoaded = !alwaysKeepLoaded;

								node.canvas.requestSave();
							});
					});

					if (shouldDisableNodeEditing(node)) {
						menu.addItem((item) => {
							this.registerDomElement(item.dom);

							const nodeData = node.getData();
							const enableEditing = nodeData.enableEditing ?? false;

							item
								.setTitle("Toggle Enable Editing")
								.setIcon(enableEditing ? "check" : "square")
								.onClick(async () => {
									node.setData({
										...nodeData,
										enableEditing: !enableEditing,
									});

									node.canvas.requestSave();
								});
						});
					}
				},
			),
		);

		this.registerEvent(
			canvasEvents.on("canvas:node:render", this.onCanvasNodeRender),
		);

		this.registerEvent(
			canvasEvents.on(
				"canvas:node:mountContent",
				this.onCanvasNodeMountContent,
			),
		);

		this.registerEvent(
			canvasEvents.on(
				"canvas:node:startEditing",
				(node: CanvasTextNode<LunixNodeData>, next) => {
					if (shouldDisableNodeEditing(node)) {
						if (!node.getData().enableEditing) return;
					}

					next();
				},
			),
		);

		this.registerEvent(
			canvasEvents.on("canvas:node:initialize", this.onCanvasNodeInitialize),
		);

		this.registerEvent(
			canvasEvents.on("canvas:node:setFile", this.onCanvasNodeSetFile),
		);

		this.registerEvent(
			canvasEvents.on(
				"canvas:showCreationMenu",
				(
					canvas,
					_,
					menu: Menu & {
						items: MenuItem[];
					},
					pos,
					size,
				) => {
					// let newItem: MenuItem | null = null;
					menu.addItem((item) => {
						const newItem = item
							.setSection("create")
							.setTitle("Add system prompt")
							.setIcon("lucide-flame")
							.onClick(async () => {
								const newNode = canvas.createTextNode<AIEnabledNodeData>({
									pos: { x: pos.x, y: pos.y },
									text: "",
									size: size,
									focus: true,
								});

								newNode.setData({
									...newNode.getData(),
									metaType: "ai-enabled",
									message: {
										role: "system",
										content: "",
									} satisfies ChatCompletionMessageParam,
									includeOriginal: true,
								});

								canvas.requestSave();

								canvas.zoomToSelection();

								await this.nodeRender(newNode);
							});

						if (newItem !== null) {
							menu.items.splice(
								menu.items.findIndex(
									(
										i: MenuItem & {
											titleEl: HTMLDivElement;
										},
									) => i.titleEl.innerText.contains("Add card"),
								) + 1,
								0,
								menu.items.splice(menu.items.indexOf(newItem), 1)[0],
							);
						}
					});

					menu.addItem((item) => {
						item
							.setSection("create")
							.setTitle("Add Test Card")
							// another icon than flame, how about a test tube?
							.setIcon("lucide-test-tube")
							.onClick(async () => {
								await this.createArtifactNode(
									canvas,
									pos,
									`import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

const NiceButton = () => {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(!clicked);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <Button 
        onClick={handleClick}
        className={\`
          $\{clicked 
            ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600' 
            : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
          }
          text-white font-bold py-2 px-4 rounded-full shadow-lg transform transition duration-300 ease-in-out hover:scale-105
        \`}
      >
        {clicked ? 'Clicked!' : 'Click me!'}
      </Button>
      {clicked && (
        <p className="text-lg font-semibold text-gray-700 animate-bounce">
          You clicked the nice button!
        </p>
      )}
    </div>
  );
};

export default NiceButton;`,
								);
							});
					});
				},
			),
		);
	}

	private createArtifactNode = async (
		canvas: Canvas,
		pos: Point,
		src: string,
	) => {
		const newNode = canvas.createTextNode<ArtifactNodeData>({
			pos: { x: pos.x, y: pos.y },
			text: "",
			size: {
				width: 1280,
				height: 720,
			},
			focus: false,
		});

		canvas.selectOnly(newNode);

		newNode.setData({
			...newNode.getData(),
			metaType: "artifact",
			src,
			completed: true,
		} satisfies ArtifactNodeData);

		canvas.markDirty(newNode);
		await new Promise((resolve) => setTimeout(resolve, 50));
		newNode.render();
		await this.nodeRender(newNode);

		canvas.requestSave();
	};

	onunload() {
		console.log("Unloading MyPlugin.");

		// delete all .chat-message-container elements
		// document.querySelectorAll('.chat-message-container').forEach(item => item.remove());
		// document.querySelectorAll('.download-code-button').forEach(item => item.remove());
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	fixSize = async (node: CanvasTextNode<AIEnabledNodeData>) => {
		if (!node.contentEl?.isConnected) {
			return false;
		}

		const oldHeight = node.height;

		const previewView = node.contentEl?.querySelector(".markdown-preview-view");
		if (previewView?.isConnected) {
			const wantedHeight = Math.max(oldHeight, previewView.scrollHeight, 50);

			if (wantedHeight !== oldHeight) {
				node.resize({
					width: node.width,
					height: wantedHeight,
				});
				return true;
			}
		} else {
			// Create a hidden div with a fixed width and auto height
			const div = document.createElement("div");
			div.style.width = `${node.width}px`; // fixed width
			div.style.height = "auto"; // fit to content
			div.style.position = "absolute";
			div.style.visibility = "hidden";

			await MarkdownRenderer.render(
				this.app,
				(await getNodeText(this.app, node)) ?? "",
				div,
				".",
				this,
			);
			await previewToolCalls(node.getData(), div, this.app, this);

			// Append the div to the body
			document.body.appendChild(div);

			// Measure the width and height of the div
			const height = div.offsetHeight + 50;

			// Cleanup the div after measuring
			document.body.removeChild(div);

			const wantedHeight = Math.max(oldHeight, height, 50);
			if (wantedHeight !== oldHeight) {
				node.resize({
					width: node.width,
					height: wantedHeight,
				});
				return true;
			}
		}

		return node.height !== oldHeight;
	};

	performAICompletion = async ({
		app,
		canvas,
		node,
		options,
		mode,
	}: PerformAICompletionParams) => {
		const nodeData = node.getData();

		const nodeId = nodeData.id;
		if (
			nodeData.message?.role === "assistant" ||
			nodeData.message?.role === "system"
		) {
			try {
				let referenceNode = options?.referenceNode;

				if (mode === "user") {
					// every n user messages, go back up and to the right of the messages
					const n = 3;
					const seen = new Set<string>([nodeId]);

					let count = 0;

					let current = getParent(canvas, node);
					let oldestNode: CanvasTextNode = node;
					while (current !== null) {
						oldestNode = current;

						if (current.getData().message?.role === "user") {
							count++;
						}

						const currentId = current.getData().id;
						if (seen.has(currentId)) {
							break;
						}

						seen.add(currentId);

						current = getParent(canvas, current);
					}

					if (count >= n && count % n === 0) {
						referenceNode = oldestNode;
					}

					new Notice(`Count: ${count}.`);
				}

				const inputNode = await tryAddNeighbour<AIEnabledNodeData>(
					canvas,
					node,
					50,
					true,
					{
						...options,
						referenceNode: mode === "tool" ? undefined : referenceNode,
						offset:
							mode === "tool"
								? {
										x: node.getData().width + 50,
										y: 0,
									}
								: undefined,
					},
				);

				// make sure the new input node width is maximum 400
				inputNode.resize({
					width: Math.min(inputNode.getData().width, 400),
					height: inputNode.getData().height,
				});

				if (
					isMainSelection(canvas, node) ||
					isMainSelection(canvas, inputNode)
				) {
					canvas.selectOnly(inputNode);

					canvas.zoomToSelection();
				}
			} catch (_) {
				console.log("User cancelled input.");
			}

			return;
		}

		let input: ChatCompletionMessageParam;

		if (nodeData.message?.role === "tool") {
			input = nodeData.message;
		} else {
			if (!nodeData.message) {
				node.setData({
					...nodeData,
					metaType: "ai-enabled",
					message: {
						role: "user",
						content: "",
					} satisfies ChatCompletionMessageParam,
				});
			}

			if (node.child?.editor) {
				console.log("Node has editor.");
				canvas.deselect(node);
				await new Promise((resolve) => setTimeout(resolve, 50));
				canvas.selectOnly(node);
				await new Promise((resolve) => setTimeout(resolve, 50));
			}

			await this.fixSize(node);

			const userInput = await getUserInput(app, this, node);
			if (userInput === null) {
				console.log("User cancelled input.");
				return;
			}

			input = userInput;
		}

		const parentHierarchy: ChatCompletionMessageParam[] = [];

		const seen = new Set<string>([nodeId]);
		let current = getParent(canvas, node);

		let disableFunctions = false;
		let includeOriginalSystemPrompt = true;

		while (current !== null) {
			const currentId = current.getData().id;
			if (seen.has(currentId)) {
				break;
			}

			seen.add(currentId);

			const nodeData = current.getData() as AIEnabledNodeData;

			if (!nodeData.message) {
				break;
			}

			let message = {
				...nodeData.message,
			};

			if (message.role === "system" || message.role === "assistant") {
				// update the data if the node text has changed
				if (!nodeData.hasArtifacts) {
					const nodeText = await getNodeText(app, current);
					if (message.content !== nodeText) {
						message.content = nodeText;

						current.setData({
							...current.getData(),
							metaType: "ai-enabled",
							message,
						});
					}
				}

				if (message.role === "assistant" && nodeData.toolCalls) {
					message.tool_calls = nodeData.toolCalls;
				}

				if (message.role === "system") {
					if (nodeData.disableFunctions) {
						disableFunctions = true;
					}
					if (!nodeData.includeOriginal) {
						includeOriginalSystemPrompt = false;
					}
				}
			} else if (message.role === "user") {
				const userInput = await getUserInput(app, this, current);
				if (userInput === null) {
					break;
				}

				message = userInput;
			}

			parentHierarchy.push({ ...message });

			current = getParent(canvas, current);
		}

		parentHierarchy.reverse();

		// console.log('parentHierarchy', parentHierarchy);

		let text = "";
		let toolCalls: ChatCompletionMessageToolCall[] = [];

		const gap = 50;

		const completionNode = await tryAddNeighbour<AIEnabledNodeData>(
			canvas,
			node,
			gap,
			false,
			options,
		);

		completionNode.alwaysKeepLoaded = true;

		completionNode.resize({
			width: 800,
			height: completionNode.getData().height,
		});

		if (isMainSelection(canvas, node)) {
			canvas.selectOnly(completionNode);
		}

		if (isMainSelection(canvas, completionNode)) {
			canvas.zoomToSelection();
		}

		completionNode.setColor("3");

		completionNode.setData({
			...completionNode.getData(),
			metaType: "ai-enabled",
			message: {
				role: "assistant",
				content: "",
			},
		} satisfies AIEnabledNodeData);

		const messages = [...parentHierarchy, input];

		const now = new Date();

		const datePart = now.toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
			weekday: "short",
		});

		const timePart = now.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
		});

		const humanReadableDateString = `${datePart}, ${timePart}`;

		// if there's no system message, include one as the first message
		const currentTime = `Current time for me: ${humanReadableDateString}. YOU MUST be aware of it, and use the current time, especially for relative dates and times, or when I ask for it.`;

		if (includeOriginalSystemPrompt) {
			messages.unshift({
				role: "system",
				content: defaultSystemPrompt,
			} satisfies ChatCompletionMessageParam);
		}

		if (!disableFunctions && allTools.length > 0) {
			messages.push({
				role: "system",
				content: toolsPrompt,
			} satisfies ChatCompletionMessageParam);
		}

		// const lastSystemIndex = messages.findLastIndex(
		// 	(message) => message.role === "system",
		// );
		//
		// if (lastSystemIndex !== -1) {
		// 	// append the current time to the last system message
		// 	const lastSystemMessage = messages[lastSystemIndex];
		//
		// 	let currentContent = lastSystemMessage.content ?? "";
		//
		// 	if (currentContent.length > 0) {
		// 		currentContent += "\n";
		// 	}
		//
		// 	currentContent += currentTime;
		//
		// 	lastSystemMessage.content = currentContent;
		// } else {
		// 	console.error("No system message found.");
		// }

		messages.push({
			role: "system",
			content: currentTime,
		} satisfies ChatCompletionMessageParam);

		// let's do this differently...
		// let's first collect all system messages, and then go backwards from the last message as the current message
		// start the total token count with the total token count of the new message list that contains only system prompts
		// for the current message, use the tokenizer chat template function to get the tokens for that message, if the total would be less than 100k, add that after the system messages before any other messages. otherwise, we're done
		// exceptional situation: the tool call response messages (can be multiple) have to follow the last assistant message before them. so if assistant+tool calls combo doesn't fit, we're done adding

		const systemMessages = messages.filter(
			(message) => message.role === "system",
		);

		let totalTokens = getTokens(systemMessages).length;

		const otherMessages = messages.filter(
			(message) => message.role !== "system",
		);

		const nonSystemMessageList: ChatCompletionMessageParam[] = [];
		const maxTokens = 150000;

		for (let i = otherMessages.length - 1; i >= 0; i--) {
			const message = otherMessages[i];

			if (message.role === "tool") {
				// exceptional situation: the tool call response messages (can be multiple) have to follow the last assistant message before them. so if assistant+tool calls combo doesn't fit, we're done adding
				const toolMessagesPlusAssistant: ChatCompletionMessageParam[] = [
					message,
				];

				for (let j = i - 1; j >= 0; j--) {
					const prevMessage = otherMessages[j];
					toolMessagesPlusAssistant.unshift(prevMessage);

					if (prevMessage.role === "assistant") {
						break;
					}
				}

				const tokenCount = getTokens(toolMessagesPlusAssistant).length;

				if (totalTokens + tokenCount > maxTokens) {
					break;
				}

				nonSystemMessageList.unshift(...toolMessagesPlusAssistant);

				i -= toolMessagesPlusAssistant.length - 1;

				totalTokens += tokenCount;
			} else {
				const tokenCount = getTokens([message]).length;

				if (totalTokens + tokenCount > maxTokens) {
					break;
				}

				nonSystemMessageList.unshift(message);

				totalTokens += tokenCount;
			}
		}

		const messagesToUse: ChatCompletionMessageParam[] = [
			...systemMessages,
			...nonSystemMessageList,
		];

		const abortController = new AbortController();

		let lastResizeTime = 0;
		let resizing = false;

		const checkResize = async () => {
			if (resizing) {
				return;
			}

			// if it has been 100ms since lastResizeTime, then we can resize
			if (Date.now() > lastResizeTime + 100) {
				resizing = true;
				try {
					completionNode.render();

					lastResizeTime = Date.now();

					if (await this.fixSize(completionNode)) {
						if (isMainSelection(canvas, completionNode)) {
							canvas.zoomToSelection();
						}
					}
				} finally {
					resizing = false;
				}
			}
		};

		let processingArtifacts = false;
		let enqueuedProcessArtifacts = false;
		let isFinished = false;

		const processArtifacts = async (blocks: ArtifactMetaBlock[]) => {
			if (processingArtifacts) {
				enqueuedProcessArtifacts = true;
				return;
			}

			processingArtifacts = true;
			try {
				const artifacts = blocks.filter(
					(item): item is ArtifactBlock => item.type === "artifact",
				);

				if (artifacts.length > 0) {
					for (const artifact of artifacts) {
						let existingNodeForArtifact: CanvasTextNode<ArtifactNodeData> | null =
							null;

						const edges = canvas.edgeFrom.getArray(completionNode);
						if (edges.length > 0) {
							for (const item of edges) {
								const target = item.to.node as CanvasTextNode<ArtifactNodeData>;

								const data = target.getData();
								if (
									data &&
									data.metaType === "artifact" &&
									data.identifier === artifact.identifier
								) {
									existingNodeForArtifact = target;
									break;
								}
							}
						}

						const artifactCompleted = isFinished;

						if (!existingNodeForArtifact) {
							const newNode = await tryAddNeighbour<ArtifactNodeData>(
								canvas,
								completionNode,
								gap,
								false,
								{
									offset: {
										x: completionNode.width + gap,
										y: 0,
									},
									edgeColor: CanvasItemColor.Orange,
								},
							);

							newNode.setData({
								...newNode.getData(),
								metaType: "artifact",
								completed: artifactCompleted,
								src: artifact.content,
								identifier: artifact.identifier,
							} satisfies ArtifactNodeData);

							newNode.resize({
								width: 1280,
								height: 720,
							});

							existingNodeForArtifact = newNode;
						} else {
							existingNodeForArtifact.setData({
								...existingNodeForArtifact.getData(),
								metaType: "artifact",
								src: artifact.content,
								completed: artifactCompleted,
							} satisfies ArtifactNodeData);
						}

						canvas.requestSave();

						await new Promise((resolve) => setTimeout(resolve, 50));

						// console.log("triggering rerender", {
						// 	existingNodeForArtifact,
						// 	artifactCompleted,
						// });

						await this.nodeRender(existingNodeForArtifact);
					}
				}
			} finally {
				processingArtifacts = false;
			}

			if (enqueuedProcessArtifacts) {
				enqueuedProcessArtifacts = false;
				await processArtifacts(blocks);
			}
		};

		const addText = (newText: string) => {
			text += newText;

			const blocks = processArtifactBlocks(text);
			if (blocks.length > 0) {
				completionNode.setText(replaceBlocks(text, blocks));
				processArtifacts(blocks).catch();
			} else {
				completionNode.setText(text);
				canvas.markDirty(completionNode);
				completionNode.render();
			}

			checkResize().catch();
		};

		const updateToolCalls = (newToolCalls: ChatCompletionMessageToolCall[]) => {
			toolCalls = newToolCalls;
			completionNode.setData({
				...completionNode.getData(),
				metaType: "ai-enabled",
				toolCalls: toolCalls as ChatCompletionMessageToolCall[],
			} satisfies AIEnabledNodeData);
			completionNode.setColor(completionNode.color === "3" ? "4" : "3");
			canvas.markDirty(completionNode);
			completionNode.render();

			checkResize().catch();
		};

		let finishReason: Choice["finish_reason"] = null;

		const updateFinishReason = (newFinishReason: Choice["finish_reason"]) => {
			console.log("Finish reason updated.", newFinishReason);
			finishReason = newFinishReason;
			completionNode.setData({
				...completionNode.getData(),
				metaType: "ai-enabled",
				finishReason: finishReason,
			} satisfies AIEnabledNodeData);
		};

		const onError = async (error: string) => {
			if (isFinished) {
				return;
			}

			isFinished = true;

			addText(`> [!failure]
>  ${error}`);

			updateFinishReason("stop");

			completionNode.setColor(CanvasItemColor.Red);

			completionNode.render();

			completionNode.alwaysKeepLoaded = false;

			canvas.requestSave();

			canvas.requestFrame();

			await new Promise((resolve) => setTimeout(resolve, 50));

			if (await this.fixSize(completionNode)) {
				if (isMainSelection(canvas, completionNode)) {
					canvas.zoomToSelection();
				}
			}
		};

		const markDone = async () => {
			if (isFinished) {
				return;
			}

			isFinished = true;
			const blocks = processArtifactBlocks(text);

			console.log("Processing artifacts...", blocks);

			if (blocks.length > 0) {
				processArtifacts(blocks).catch(console.error);
			}

			completionNode.setData({
				...completionNode.getData(),
				metaType: "ai-enabled",
				message: {
					role: "assistant",
					content: text,
				} satisfies ChatCompletionMessageParam,
				hasArtifacts: blocks.length > 0,
			});

			completionNode.setColor("5");

			completionNode.render();

			canvas.requestSave();

			canvas.requestFrame();

			await new Promise((resolve) => setTimeout(resolve, 50));

			if (await this.fixSize(completionNode)) {
				if (isMainSelection(canvas, completionNode)) {
					canvas.zoomToSelection();
				}
			}

			if (finishReason === "tool_calls" && toolCalls.length > 0) {
				let lastNode = completionNode;
				let toolReferenceNode = completionNode;
				let firstToolNode: CanvasTextNode | null = null;

				const nodes: Record<string, CanvasTextNode<AIEnabledNodeData>> = {};

				for (const toolCall of toolCalls) {
					const previousNode = lastNode;
					const wantedHeight =
						toolReferenceNode === completionNode
							? Math.min(568, completionNode.getData().height)
							: 568;

					lastNode = await tryAddNeighbour<AIEnabledNodeData>(
						canvas,
						lastNode,
						gap,
						false,
						{
							referenceNode: toolReferenceNode,
							offset:
								toolReferenceNode === completionNode
									? {
											x: completionNode.getData().width + gap * 2,
											y: completionNode.getData().height - wantedHeight,
										}
									: undefined,
							edgeColor: CanvasItemColor.Orange,
						},
					);

					if (firstToolNode === null) {
						firstToolNode = previousNode;
					}

					if (isMainSelection(canvas, previousNode)) {
						canvas.selectOnly(lastNode);
						canvas.zoomToSelection();
					}

					lastNode.resize({
						width: lastNode.getData().width,
						height: wantedHeight,
					});

					toolReferenceNode = lastNode;

					lastNode.setColor("6");

					lastNode.setData({
						...lastNode.getData(),
						metaType: "ai-enabled",
						message: {
							role: "tool",
							content: "NO RESPONSE",
							tool_call_id: toolCall.id!,
						} satisfies ChatCompletionMessageParam,
					});

					lastNode.setText(`\`\`\`javascript
const result = await ${toolCall.function?.name}(${toolCall.function?.arguments});
\`\`\``);

					lastNode.render();

					await new Promise((resolve) => setTimeout(resolve, 50));

					if (isMainSelection(canvas, previousNode)) {
						canvas.selectOnly(lastNode);
						canvas.zoomToSelection();
					}

					nodes[toolCall.id!] = lastNode;
				}

				let additionalNodeReference = completionNode;

				await Promise.all(
					toolCalls.map(async (toolCall) => {
						const toolNode = nodes[toolCall.id!];

						const result = await checkToolCall({
							app: this.app,
							settings: this.settings,
							toolCall,
							tools: allTools,
							toolNode,
						});

						console.log("result", result);

						toolNode.setText(`${toolNode.getData().text}\n\`\`\`json
${result.content}
\`\`\``);

						toolNode.setData({
							...toolNode.getData(),
							metaType: "ai-enabled",
							message: {
								...toolNode.getData()?.message,
								role: "tool",
								content: result.content,
								tool_call_id: toolCall.id!,
							} satisfies ChatCompletionMessageParam,
						});

						toolNode.render();

						if (result.additionalNodes.length > 0) {
							for (const additionalNode of result.additionalNodes) {
								const prevNode = lastNode;
								const toolNode = await tryAddNeighbour<AIEnabledNodeData>(
									canvas,
									lastNode,
									gap,
									false,
									{
										referenceNode: additionalNodeReference,
									},
								);

								lastNode = toolNode;

								additionalNodeReference = toolNode;

								toolNode.moveAndResize({
									x: toolNode.x,
									y: toolNode.y,
									width: 400,
									height: 400,
								});

								toolNode.setText(additionalNode.content);

								toolNode.render();

								await new Promise((resolve) => setTimeout(resolve, 50));

								if (
									additionalNode.options?.width &&
									additionalNode.options?.height
								) {
									toolNode.resize({
										width: additionalNode.options.width,
										height: additionalNode.options.height,
									});
								} else {
									await this.fixSize(toolNode);
								}

								if (isMainSelection(canvas, prevNode)) {
									canvas.selectOnly(toolNode);
									canvas.zoomToSelection();
								}

								const message: ChatCompletionMessageParam = {
									...toolNode.getData().message,
									...additionalNode.data,
								} as unknown as ChatCompletionMessageParam;

								const newData = {
									...toolNode.getData(),
									metaType: "ai-enabled",
									message,
									isToolResult: true,
								} satisfies AIEnabledNodeData;

								console.log("newData", newData);

								toolNode.setData(newData);
							}
						}

						return {
							id: toolCall.id!,
							result,
						};
					}),
				);

				completionNode.alwaysKeepLoaded = false;

				canvas.requestSave();

				await new Promise((resolve) => setTimeout(resolve, 50));

				// do a new ai completion on lastNode
				await this.performAICompletion({
					app,
					canvas,
					node: lastNode,
					options: {
						referenceNode: additionalNodeReference,
						edgeColor: CanvasItemColor.Green,
					},
					mode: "tool",
				});
			}
		};

		try {
			if (this.settings.anthropicAPIKey !== "" && this.settings.testAnthropic) {
				await this.handleAnthropicCompletion(
					messagesToUse,
					disableFunctions,
					abortController,
					addText,
					updateToolCalls,
					updateFinishReason,
					markDone,
					onError,
				);
			} else {
				await this.handleOpenAICompletion(
					messagesToUse,
					disableFunctions,
					abortController,
					completionNode,
					addText,
					updateToolCalls,
					updateFinishReason,
					markDone,
					onError,
				);
			}
		} catch (e) {
			onError(`${e}`).catch();
		} finally {
			completionNode.alwaysKeepLoaded = false;
			canvas.requestSave();
			canvas.requestFrame();
		}
	};

	private async handleOpenAICompletion(
		messagesToUse: ChatCompletionMessageParam[],
		disableFunctions: boolean,
		abortController: AbortController,
		completionNode: CanvasTextNode<AIEnabledNodeData>,
		addText: (newText: string) => void,
		updateToolCalls: (toolCalls: ChatCompletionMessageToolCall[]) => void,
		updateFinishReason: (finishReason: Choice["finish_reason"]) => void,
		markDone: () => Promise<void>,
		onError: (error: string) => Promise<void>,
	) {
		try {
			const toolCalls: DeltaToolCall[] = [];
			const params: ChatCompletionCreateParamsStreaming = {
				model: "gpt-4o",
				messages: messagesToUse,
				stream: true,
				tools: disableFunctions ? undefined : allTools.map(({ tool }) => {
					// make sure tool description is max 1024 characters
					const description = tool.function.description;
					if (description && description.length > 1024) {
						return {
							...tool,
							function: {
								...tool.function,
								description: description.slice(0, 1024),
							},
						};
					}
					return tool;
				}),
			};

			const openai = new OpenAI({
				apiKey: this.settings.openaiAPIKey,
				dangerouslyAllowBrowser: true,
			});

			const stream = await openai.chat.completions.create(params, {
				signal: abortController.signal,
			});

			for await (const chunk of stream) {
				if (completionNode.destroyed) {
					new Notice("Node destroyed.");
					abortController.abort();
					return;
				}

				const choice = chunk.choices[0];
				if (!choice) {
					continue;
				}

				const delta = choice.delta;

				if (delta.tool_calls) {
					const oldToolCalls = JSON.stringify(toolCalls);
					for (const toolCall of delta.tool_calls) {
						const { index } = toolCall;

						let item = toolCalls.find((item) => item.index === index);

						if (!item) {
							item = {
								...toolCall,
							};
							toolCalls.push(item);
						} else {
							// merge the tool call
							streamObject(item ?? {}, toolCall);
						}
					}

					if (oldToolCalls !== JSON.stringify(toolCalls)) {
						updateToolCalls(toolCalls as ChatCompletionMessageToolCall[]);
					}
				}

				if (delta.content !== undefined && delta.content !== "") {
					if (delta.content) {
						addText(delta.content);
					}
				}

				if (choice.finish_reason) {
					updateFinishReason(choice.finish_reason);
				}
			}

			await markDone();
		} catch (error) {
			console.error("Error", error);
			onError(`${error}`).catch();
		}
	}

	private async handleAnthropicCompletion(
		messagesToUse: ChatCompletionMessageParam[],
		disableFunctions: boolean,
		abortController: AbortController,
		addText: (newText: string) => void,
		updateToolCalls: (toolCalls: ChatCompletionMessageToolCall[]) => void,
		updateFinishReason: (finishReason: Choice["finish_reason"]) => void,
		markDone: () => Promise<void>,
		onError: (error: string) => Promise<void>,
	) {
		const host = "o4os8wc.194.31.140.80.sslip.io";
		// const host = "localhost";
		const port = 49153;
		// const port = 8082;
		const completionClient =
			new WebSocketCompletionClient<ClaudeCompletionServerConfig>(host, port);

		const allToolCalls: ChatCompletionMessageToolCall[] = [];

		try {
			await completionClient.config("test", {
				apiKey: this.settings.anthropicAPIKey,
			});

			const params: CompletionClientGetCompletionParams = {
				communityId: "test",
				request: {
					parts: messagesToUse.map((item) => {
						const part: RequestPart = {
							role: MessagePartRole.User,
							name: undefined,
							content: undefined,
						};

						switch (item.role) {
							case "user":
								part.role = MessagePartRole.User;
								part.name = item.name;
								part.content =
									typeof item.content === "string"
										? [
												{
													type: ContentPartType.Text,
													textContent: item.content,
												},
											]
										: item.content.map((contentItem) => {
												switch (contentItem.type) {
													case "text": {
														const result: RequestContentItem = {
															type: ContentPartType.Text,
															textContent: contentItem.text,
														};

														return result;
													}
													case "image_url": {
														const result: RequestContentItem = {
															type: ContentPartType.Image,
															imageContent:
																contentItem.image_url.url.split(",")[1],
															contentType: "image/png",
														};

														return result;
													}
													default:
														throw new Error(
															`Unknown content type: ${(contentItem as ChatCompletionContentPart).type}`,
														);
												}
											});
								break;
							case "assistant":
								part.role = MessagePartRole.Assistant;
								part.content = [];
								if (item.content) {
									part.content.push({
										type: ContentPartType.Text,
										textContent: item.content,
									});
								}

								if (item.tool_calls) {
									part.content.push(
										...item.tool_calls.map((call, index) => {
											return {
												type: ContentPartType.ToolCalls,
												toolCalls: [
													{
														index,
														id: call.id,
														function: {
															name: call.function.name,
															arguments: call.function.arguments,
														},
													},
												],
											} satisfies ToolCallsContentPart;
										}),
									);
								}
								break;
							case "system":
								part.role = MessagePartRole.System;
								part.name = item.name;
								part.content = [
									{
										type: ContentPartType.Text,
										textContent: item.content,
									},
								];
								break;
							case "tool":
								part.role = MessagePartRole.Tool;
								// part.name = item.tool_call_id;
								part.content = [
									{
										type: ContentPartType.ToolCallResponse,
										name: item.tool_call_id,
										id: item.tool_call_id,
										content: item.content,
									},
								];
								break;
							default:
								console.error("Unknown role", item);
						}

						return part;
					}),
					stream: true,
					max_tokens: 4096,
					temperature: 0.7,
					top_p: 0.95,
					tools: disableFunctions
						? []
						: allTools.map((toolInfo) => {
								return {
									schema: toolInfo.schema,
									function: (args, _runner) => {
										const apiKeyField = toolInfo.apiKeyField;
										const apiKey = apiKeyField
											? (this.settings[apiKeyField] as string)
											: undefined;

										return toolInfo.perform(
											this.app,
											apiKey,
											args,
											(
												content: string,
												data: ChatCompletionMessageParam,
												options,
											) => {
												console.log("additional nodes: ", {
													content,
													data,
													options,
												});
											},
										);
									},
									name: toolInfo.tool.function.name,
									description: toolInfo.tool.function.description,
								} satisfies CompletionClientTool<any, any>;
							}),
				},
				remainingFunctionCalls: 0,
				abortController,
				onError: (error) => {
					console.error("Error", error);
					onError(error).catch();
				},
				onMessageStart: (id) => {
					console.log("Start", id);
				},
				onMessageEnd: (id, finishReason) => {
					console.log("End", id, finishReason);
					updateFinishReason(finishReason ?? null);

					markDone();
				},
				onMessagePart: (id, { type, role, message }) => {
					console.log("Part", id, {
						type,
						role,
						message,
					});
					switch (type) {
						case ContentPartType.Text:
							message.addUpdateHandler((update) => {
								// only print what's added
								const content = update.delta ?? "";

								// console.log("text", JSON.stringify(content));
								if (content.length > 0) {
									addText(content);
								}
							});
							message.addEndHandler(() => {
								console.log("end text", message);
							});
							break;

						case ContentPartType.ToolCalls: {
							// let lastToolCalls = '';

							message.addUpdateHandler((update) => {
								console.log("toolCalls", JSON.stringify(update));
								// const toolCallsString = update.toolCalls
								// 	.map((toolCall) => {
								// 		return `${toolCall.index}:${toolCall.function.name}${toolCall.function.arguments ? `:${toolCall.function.arguments}` : ''}`;
								// 	})
								// 	.join('\n');
								//
								// // only print what's added
								// const content = toolCallsString.slice(lastToolCalls.length);
								// lastToolCalls = toolCallsString;
								// setImmediate(() => {
								// 	process.stdout.write(content);
								// 	process.stdout.write('\n');
								// });

								// if(allToolCalls.find(tool => tool.id === item.id)) {
								//
								// }

								for (const item of update.toolCalls) {
									const mapped: ChatCompletionMessageToolCall = {
										id: item.id,
										type: "function",
										function: {
											name: item.function.name,
											arguments: item.function.arguments,
										},
									};

									const index = allToolCalls.findIndex(
										(tool) => tool.id === item.id,
									);

									if (index === -1) {
										allToolCalls.push(mapped);
									} else {
										allToolCalls[index] = mapped;
									}
								}

								updateToolCalls(allToolCalls);
							});
							message.addEndHandler(() => {
								console.log("end function call", message);
							});
							break;
						}
						default:
							console.log("UNKNOWN onMessageStart", type, role, message);
							break;
					}
				},
			};

			console.log("params", params);

			await completionClient.getCompletion(params);
		} finally {
			await completionClient.close();
		}
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: Lunix;

	constructor(app: App, plugin: Lunix) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("OpenAI API Key")
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.openaiAPIKey)
					.onChange(async (value) => {
						this.plugin.settings.openaiAPIKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Anthropic API Key")
			.setDesc("Anthropic API Key")
			.addText((text) =>
				text
					.setPlaceholder("...")
					.setValue(this.plugin.settings.anthropicAPIKey)
					.onChange(async (value) => {
						this.plugin.settings.anthropicAPIKey = value;
						await this.plugin.saveSettings();
					}),
			);

		// a toggle for testAnthropic: boolean
		new Setting(containerEl)
			.setName("Test Anthropic")
			.setDesc("Test Anthropic")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.testAnthropic)
					.onChange(async (value) => {
						this.plugin.settings.testAnthropic = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Brave API Key")
			.setDesc("Brave API Key")
			.addText((text) =>
				text
					.setPlaceholder("...")
					.setValue(this.plugin.settings.braveAPIKey)
					.onChange(async (value) => {
						this.plugin.settings.braveAPIKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Firecrawl API Key")
			.setDesc("Firecrawl API Key")
			.addText((text) =>
				text
					.setPlaceholder("...")
					.setValue(this.plugin.settings.firecrawlAPIKey)
					.onChange(async (value) => {
						this.plugin.settings.firecrawlAPIKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Serp API Key")
			.setDesc("Serp API Key")
			.addText((text) =>
				text
					.setPlaceholder("...")
					.setValue(this.plugin.settings.serpAPIKey)
					.onChange(async (value) => {
						this.plugin.settings.serpAPIKey = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
