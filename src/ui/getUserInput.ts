import {
	type App,
	type Component,
	type FileView,
	MarkdownRenderer,
	Notice,
	arrayBufferToBase64,
} from "obsidian";
import type { CanvasTextNode } from "~/shared/types";
import type { AIEnabledNodeData } from "~/types/LunixNodeData";
import type {
	ChatCompletionContentPart,
	ChatCompletionContentPartImage,
	ChatCompletionUserMessageParam,
} from "~/types/openai";
import { resizeBase64Image } from "~/ui/resizeBase64Image";

const tempDiv = createDiv();

export const getUserInput = async (
	app: App,
	component: Component,
	node: CanvasTextNode<AIEnabledNodeData>,
): Promise<ChatCompletionUserMessageParam | null> => {
	const nodeData = node.getData();

	const dataMessage = nodeData.message;
	if (dataMessage?.role !== "user") {
		return null;
	}

	let inputText: string = nodeData.text;

	if (node.child?.editor) {
		inputText = node.child.editor.getValue();
	}

	if (!inputText) {
		if (nodeData.type === "file") {
			const filePath = nodeData.file;

			// get the file contents
			const fileByPath = app.vault.getFileByPath(filePath);

			if (!fileByPath) {
				new Notice("File not found.");
				return null;
			}

			inputText = await app.vault.cachedRead(fileByPath);
		} else {
			return null;
		}
	}

	const message = {
		role: "user",
		name: dataMessage.name,
		content: [
			{
				type: "text",
				text: inputText,
			},
		] as ChatCompletionContentPart[],
	} satisfies ChatCompletionUserMessageParam;

	const viewFile = (node.canvas.view as FileView).file;
	if (viewFile) {
		tempDiv.innerHTML = "";
		await MarkdownRenderer.render(
			app,
			inputText,
			tempDiv,
			viewFile ? viewFile.path : ".",
			component,
		);

		// console.log('tempDiv html', tempDiv.outerHTML);
	}

	const seenUrls = new Set<string>();

	const images: ChatCompletionContentPartImage[] = [];

	// find images that match ![[...]] syntax and add them to the message
	const imageRegex = /!\[\[(.*?)]]/g;
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	while ((match = imageRegex.exec(inputText)) !== null) {
		try {
			const src = match[1];

			console.log(`Found image src: ${src}`);

			if (seenUrls.has(src)) {
				continue;
			}

			seenUrls.add(src);

			if (src.startsWith("data:image")) {
				images.push({
					type: "image_url",
					image_url: {
						url: src,
					},
				} satisfies ChatCompletionContentPartImage);

				continue;
			}

			let file = app.vault.getAbstractFileByPath(src);

			if (!file) {
				file = app.vault.getFiles().find((f) => f.path.includes(src)) ?? null;
			}

			if (!file) {
				continue;
			}

			const binaryData = await app.vault.adapter.readBinary(file.path);
			const base64 = arrayBufferToBase64(binaryData);
			const resizedBase64 = await resizeBase64Image(
				`data:image/png;base64,${base64}`,
			);

			images.push({
				type: "image_url",
				image_url: {
					url: resizedBase64,
				},
			} satisfies ChatCompletionContentPartImage);
		} catch (e) {
			console.error(e);
		}
	}

	message.content.push(...images);
	node.setData({
		...node.getData(),
		metaType: "ai-enabled",
		message: {
			...message,
			content: [], // content will be filled in automatically
		} satisfies ChatCompletionUserMessageParam,
	} satisfies AIEnabledNodeData);
	node.render();
	return message;
};
