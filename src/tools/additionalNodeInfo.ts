import type {ChatCompletionMessageParam} from "~/types/openai";

export type AdditionalNodeInfo = {
	content: string;
	data: ChatCompletionMessageParam;
	options?: {
		width?: number;
		height?: number;
	}
};
