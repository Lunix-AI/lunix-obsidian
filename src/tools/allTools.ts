import type { ToolConfig } from "~/toolConfig";
import { evaluateCodeTool } from "~/tools/evaluateCodeTool";
import { braveSearchTool } from "~/tools/performBraveSearch";
import { browseTool } from "~/tools/performBrowse";
import { drawTool } from "~/tools/performDraw";
import { googleSearchTool } from "~/tools/performGoogleSearch";

export const allTools: ToolConfig<any, any>[] = [
	braveSearchTool,
	googleSearchTool,
	browseTool,
	// evaluateCodeTool,
	drawTool,
];
