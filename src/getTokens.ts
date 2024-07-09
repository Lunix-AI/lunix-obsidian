import {fromPreTrained} from "@lenml/tokenizer-gpt4o";
import type OpenAI from "openai";

const tokenizer = fromPreTrained();

tokenizer.chat_template = `{% for message in messages %}
    {{'<|im_start|>' + message['role'] + '\\n' + message['content'] + '<|im_end|>' + '\\n'}}
{% endfor %}`;

export function getTokens(systemMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]) {
	return tokenizer.apply_chat_template(systemMessages.map(item => {
		let content: string;
		if (typeof item.content === 'string') {
			content = item.content;
		} else {
			content = JSON.stringify(item.content?.filter(item => item.type === 'text'));
		}
		return {
			role: item.role,
			content,
		}
	}, {
		tokenize: true,
		return_tensor: false,
	})) as number[];
}
