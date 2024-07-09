import { type App, type Component, MarkdownRenderer } from "obsidian";
import type { AIEnabledNodeData } from "~/types/LunixNodeData";

export const previewToolCalls = async (
	nodeData: AIEnabledNodeData,
	previewView: HTMLDivElement,
	app: App,
	component: Component,
) => {
	if (nodeData.toolCalls) {
		const simpleDiv = (previewView.querySelector(".simple-div") ??
			previewView.createDiv({
				cls: "simple-div",
			})) as HTMLDivElement;

		simpleDiv.innerHTML = "";
		const wantedMarkdown = `---

Tool Calls:

\`\`\`json
${JSON.stringify(nodeData.toolCalls, null, 2)}
\`\`\``;

		await MarkdownRenderer.render(
			app,
			wantedMarkdown,
			simpleDiv,
			".",
			component,
		);
	}
};
