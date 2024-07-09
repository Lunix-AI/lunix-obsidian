import type { CanvasFileData, CanvasTextData } from "obsidian/canvas";
import type {
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall,
	Choice,
} from "~/types/openai";

export type BaseLunixNodeData = CanvasTextData | CanvasFileData;

export type AIEnabledNodeData = BaseLunixNodeData & {
	metaType: "ai-enabled";
	message?: ChatCompletionMessageParam;
	isToolResult?: boolean;
	toolCalls?: ChatCompletionMessageToolCall[];
	finishReason?: Choice["finish_reason"];
	disableFunctions?: boolean;
	includeOriginal?: boolean;
	hasArtifacts?: boolean;
};

export type ArtifactNodeData = BaseLunixNodeData & {
	metaType: "artifact";
	identifier: string;
	src: string;
	completed: boolean;
	useTemplate: boolean;
};

export type AdditionalContentNodeData = BaseLunixNodeData & {
	metaType: "additional-content";
};

export type LunixNodeData = { enableEditing?: boolean } & (
	| ArtifactNodeData
	| AIEnabledNodeData
	| AdditionalContentNodeData
);
