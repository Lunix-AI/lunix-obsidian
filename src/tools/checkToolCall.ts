import { getTokens } from "~/getTokens";
import type { AdditionalNodeInfo } from "~/tools/additionalNodeInfo";
import type { CheckToolCallParams } from "~/tools/checkToolCallParams";
import type { ChatCompletionMessageParam } from "~/types/openai";

export const checkToolCall = async ({
	app,
	settings,
	toolCall,
	tools,
	toolNode,
}: CheckToolCallParams): Promise<{
	success: boolean;
	content: string;
	additionalNodes: AdditionalNodeInfo[];
}> => {
	try {
		const functionName = toolCall.function?.name;
		const toolInfo = functionName
			? tools.find((item) => item.tool.function.name === functionName)
			: undefined;
		if (toolInfo) {
			const additionalNodes: AdditionalNodeInfo[] = [];

			const parsed = toolInfo.schema.safeParse(
				JSON.parse(toolCall.function?.arguments ?? "{}"),
			);

			if (!parsed.success) {
				const detailedErrorMessage = parsed.error.errors
					.map((error) => error.message)
					.join(", ");

				return {
					success: false,
					content: `Invalid arguments: ${detailedErrorMessage}`,
					additionalNodes: [],
				};
			}

			const apiKeyField = toolInfo.apiKeyField;
			const apiKey = apiKeyField
				? (settings[apiKeyField] as string)
				: undefined;
			const toolResult = await toolInfo.perform(
				app,
				apiKey,
				parsed.data,
				(content: string, data: ChatCompletionMessageParam, options) => {
					additionalNodes.push({
						content,
						data,
						options,
					});
				},
			);

			let stringResult = JSON.stringify(toolResult, null, 2);

			let fitsIntoTokens = false;

			while (!fitsIntoTokens) {
				const numTokens = getTokens([
					{
						role: "tool",
						content: stringResult,
						tool_call_id: toolCall.id!,
					},
				]).length;
				if (numTokens > 50_000) {
					// remove the last 25% of the string
					stringResult = `${stringResult.slice(0, Math.floor(stringResult.length * 0.75))}...`;
				} else {
					fitsIntoTokens = true;
				}
			}

			if (stringResult.trim().length === 0) {
				return {
					success: false,
					content: "Tool returned empty content.",
					additionalNodes: [],
				};
			}

			return {
				success: true,
				content: stringResult,
				additionalNodes,
			};
		}
	} catch (e) {
		console.error(e);

		return {
			success: false,
			content: e.toString(),
			additionalNodes: [],
		};
	}

	return {
		success: false,
		content: "Tool not found.",
		additionalNodes: [],
	};
};
