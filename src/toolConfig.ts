import type {LunixSettings} from "~/lunixSettings";
import type {ChatCompletionMessageParam, ChatCompletionTool} from "~/types/openai";
import type {App} from "obsidian";
import type {z, ZodSchema, ZodTypeAny} from "zod";
import {getParams} from "~/tools/getParams";

export type ProduceAdditionalNodes = (content: string, data: ChatCompletionMessageParam, options?: {
	width?: number;
	height?: number;
}) => void;

export type PerformFunction<T extends object, TKeyField extends keyof LunixSettings | undefined = undefined> = (
	app: App,
	apiKey: TKeyField extends string ? string : undefined,
	params: T,
	produceAdditionalNodes: ProduceAdditionalNodes,
) => Promise<unknown>;

export type ToolConfig<T extends object, TKeyField extends keyof LunixSettings | undefined = keyof LunixSettings> = {
	apiKeyField: keyof LunixSettings | undefined;
	tool: ChatCompletionTool;
	perform: PerformFunction<T, TKeyField>;
	schema: ZodSchema<T>;
}

export const prepareToolConfig = <TParams extends ZodTypeAny, TKeyField extends keyof LunixSettings | undefined = undefined>(
	apiKeyField: TKeyField,
	name: string,
	description: string,
	params: TParams,
	perform: PerformFunction<z.infer<TParams>, TKeyField>
): ToolConfig<z.infer<TParams>, TKeyField> => {
	return {
		apiKeyField,
		tool: {
			type: 'function',
			function: {
				name,
				description,
				parameters: getParams(params),
			}
		} satisfies ChatCompletionTool,
		perform,
		schema: params,
	}
}
