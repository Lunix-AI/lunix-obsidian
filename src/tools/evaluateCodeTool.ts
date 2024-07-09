import type { App } from "obsidian";
import { z } from "zod";
import { prepareToolConfig } from "~/toolConfig";
import { formatError } from "~/tools/formatError";
import { iframeCode } from "~/tools/iframeCode";
import type {
	CallFunctionMessage,
	GetStorageValueResponseMessage,
	ServerMessage,
	SetStorageValueResponseMessage,
} from "~/tools/types";
import type { Listener } from "~/tools/types/listener";

let messageId = 0;

const callResponseEventListeners = new Map<number, Listener>();

const addWindowResponseListener = (id: number, listener: Listener) => {
	callResponseEventListeners.set(id, listener);
};

const removeWindowResponseListener = (id: number) => {
	callResponseEventListeners.delete(id);
};

const iframeLoadEventListeners: Array<() => void> = [];

const addOnLoadListener = (listener: () => void) => {
	iframeLoadEventListeners.push(listener);
};

const removeOnLoadListener = (listener: () => void) => {
	const index = iframeLoadEventListeners.indexOf(listener);
	if (index > -1) {
		iframeLoadEventListeners.splice(index, 1);
	}
};

const onWindowMessage = (event: MessageEvent<ServerMessage>) => {
	const eventData = event.data;

	const eventSource: WindowProxy | null =
		event.source as unknown as WindowProxy | null;
	if (!eventSource) {
		return;
	}

	if (eventData.messageType !== "evalClientMessage") return;

	switch (eventData.action) {
		case "callResponse": {
			const listener = callResponseEventListeners.get(eventData.id);
			if (listener) {
				if ("success" in eventData && eventData.success) {
					listener.resolve(eventData.value);
				} else {
					listener.reject((eventData as any).error);
				}
			}
			break;
		}
		case "getStorageValue":
			try {
				const value = JSON.parse(localStorage.getItem(eventData.key) ?? "null");
				const message: GetStorageValueResponseMessage = {
					messageType: "evalServerMessage",
					action: "getStorageValueResponse",
					id: eventData.id,
					success: true,
					value,
				};
				eventSource.postMessage(message, event.origin);
			} catch (e) {
				const message: GetStorageValueResponseMessage = {
					messageType: "evalServerMessage",
					action: "getStorageValueResponse",
					id: eventData.id,
					success: false,
					error: formatError(e),
				};
				eventSource.postMessage(message, event.origin);
			}
			break;
		case "setStorageValue":
			try {
				localStorage.setItem(eventData.key, JSON.stringify(eventData.value));
				const message: SetStorageValueResponseMessage = {
					messageType: "evalServerMessage",
					action: "setStorageValueResponse",
					id: eventData.id,
					success: true,
				};
				eventSource.postMessage(message, event.origin);
			} catch (e) {
				const message: SetStorageValueResponseMessage = {
					messageType: "evalServerMessage",
					action: "setStorageValueResponse",
					id: eventData.id,
					success: false,
					error: formatError(e),
				};
				eventSource.postMessage(message, event.origin);
			}
			break;
		case "iframeLoaded":
			for (const listener of iframeLoadEventListeners) {
				listener();
			}
			break;
		default:
			console.log("unknown action:", (eventData as ServerMessage).action);
			break;
	}
};

window.addEventListener("message", onWindowMessage);

const executeMessage = async (
	iframe: HTMLIFrameElement,
	input: any,
): Promise<unknown> => {
	const id = messageId++;

	const messageWithId: CallFunctionMessage = {
		messageType: "evalServerMessage",
		action: "callFunction",
		input,
		id,
	};

	try {
		return await new Promise((resolve, reject) => {
			addWindowResponseListener(id, {
				resolve,
				reject,
			});

			iframe.contentWindow!.postMessage(messageWithId);
		});
	} finally {
		removeWindowResponseListener(id);
	}
};

const safeEval = (code: string, input: any): Promise<unknown> =>
	new Promise((resolve, reject) => {
		const iframe = document.createElement("iframe");
		iframe.style.width = "400px";
		iframe.style.height = "400px";
		iframe.style.position = "absolute";
		iframe.style.visibility = "hidden";

		document.body.appendChild(iframe);

		const contentWindow = iframe.contentWindow!;

		const onLoaded = () => {
			removeOnLoadListener(onLoaded);

			contentWindow.postMessage(
				{
					action: "setFunction",
					value: code,
				},
				"*",
			);

			executeMessage(iframe, input)
				.then(resolve)
				.catch(reject)
				.finally(() => {
					iframe.remove();
				});
		};

		addOnLoadListener(onLoaded);

		contentWindow.document.open();
		// language=HTML
		contentWindow.document.write(`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<title>iframe content</title>
				<script>
					let firstLoad = true;
					const markLoaded = () => {
						if (!firstLoad) return;
						firstLoad = false;
						window.parent.postMessage({action: 'iframeLoaded'}, '*');
					}
				</script>
			</head>
			<body onload="markLoaded()">
			<script>
				(${iframeCode.toString()})();
			<\/script>
			</body>
			</html>
        `);
		contentWindow.document.close();
	});

export const evaluateCodeTool = prepareToolConfig(
	undefined,
	"runJavascript",
	`Executes the given JavaScript code in the client side.

Use it only for getting the outputs of simple code, string manipulation, etc.

This code will run in an iframe in the browser, so DO NOT use it to do anything that requires server-side access.

For anything server-side or more complicated, or typescript, and so on, you MUST respond to me with a code block instead.`,
	z.object({
		input: z
			.any()
			.describe(
				"The input to pass to the code function. This is not optional, you have to provide a value.",
			),
		// language=TEXT
		jsFunction: z.string().describe(`The function to run.
This should be a function that takes an input and storage object as arguments.
The storage object has \`async get(key: string): Promise<any>\` and \`async set(key: string, value: any): Promise<void>\` methods. If not necessary, you can omit the parameter.
Example code: \`async function (input, storage) { const storedValue = await storage.get('key'); await storage.set('key', storedValue + 1); return storedValue; }\`.
The function should return a value that will be displayed in the result of the tool.
This code is executed inside a browser, so you cannot use things such as 'require' or 'import'.
Instead of 'fetch', use 'window.request': function request({ url: string; method?: string; contentType?: string; body?: string | ArrayBuffer; headers?: Record<string, string>; /**
     * Whether to throw an error when the status code is 400+
     * Defaults to true
     * @public
     */ throw?: boolean; }) => Promise<string>;`),
	}),
	async (_app: App, _apiKey, { input, jsFunction }) => {
		return await safeEval(jsFunction, input);
	},
);
