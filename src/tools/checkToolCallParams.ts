import type { App } from "obsidian";
import type { LunixSettings } from "~/lunixSettings";
import type { CanvasTextNode } from "~/shared/types";
import type { ToolConfig } from "~/toolConfig";
import type { AIEnabledNodeData } from "~/types/LunixNodeData";
import type { ChatCompletionMessageToolCall } from "~/types/openai";

export interface CheckToolCallParams {
	app: App;
	settings: LunixSettings;
	toolCall: ChatCompletionMessageToolCall;
	tools: ToolConfig<any, any>[];
	toolNode: CanvasTextNode<AIEnabledNodeData>;
}
