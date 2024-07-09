// noinspection JSDeprecatedSymbols

import type OpenAI from "openai";

// import {ChatCompletionCreateParamsStreaming} from "openai/src/resources/chat/completions";

export type ChatCompletionTool = OpenAI.ChatCompletionTool;
export type FunctionParameters = OpenAI.FunctionParameters;
export type ChatCompletionMessageParam = Exclude<
	OpenAI.Chat.ChatCompletionMessageParam,
	OpenAI.Chat.ChatCompletionFunctionMessageParam
>;
export type ChatCompletionUserMessageParam = OpenAI.Chat.ChatCompletionUserMessageParam;

export type Choice = OpenAI.Chat.ChatCompletionChunk.Choice;
export type DeltaToolCall = OpenAI.Chat.ChatCompletionChunk.Choice.Delta.ToolCall;
export type ChatCompletionMessageToolCall = OpenAI.ChatCompletionMessageToolCall;
export type ChatCompletionContentPart = OpenAI.ChatCompletionContentPart;
export type ChatCompletionContentPartImage = OpenAI.ChatCompletionContentPartImage;


export type ChatCompletionCreateParamsStreaming = OpenAI.Chat.ChatCompletionCreateParamsStreaming;
