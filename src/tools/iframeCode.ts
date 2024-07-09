import type { RequestUrlParam, request } from "obsidian";
import type {
	CallResponseMessage,
	ClientMessage,
	GetStorageValueMessage,
	SetStorageValueMessage,
} from "~/tools/types";
import type { Listener } from "~/tools/types/listener";

type ExecutorStorage = {
	get: (key: string) => Promise<any>;
	set: (key: string, value: any) => Promise<void>;
};

type IframeWindow = Omit<Window, "fetch"> & {
	fetch: typeof request;
	request: typeof request;
};

type TopWindow = Omit<Window, "request"> & {
	request: typeof request;
};

export const iframeCode = () => {
	const formatError = (e: unknown) => {
		if (e instanceof Error) {
			// Handles standard Error objects
			return `${e.name}: ${e.message}\n${e.stack}`;
		}
		if (typeof e === "object") {
			try {
				// Attempts to JSON-serialize the object if possible
				return `Object: ${JSON.stringify(e)}`;
			} catch (jsonError) {
				// If JSON serialization fails, use a different approach
				return `Object, could not stringify: ${String(e)}`;
			}
		} else {
			// Handles non-object types (e.g., strings, numbers)
			return String(e);
		}
	};

	const top = window.top as unknown as TopWindow;

	if (!top) {
		return;
	}

	const selfWindow = window as unknown as IframeWindow;

	// make fetch send a message to the upper window which will handle the request for us
	selfWindow.fetch = selfWindow.request = async (
		_params: RequestUrlParam | string,
	) => {
		let params = _params;

		console.log("DEF: Fetching", params);
		if (typeof params === "string") {
			params = { url: params };
		}

		params.method = params.method || "GET";

		const result = await top.request(params);

		console.log("DEF: Fetch result:", result);
		return result;
	};

	let userCode = async (input: string, storage: ExecutorStorage) => {
		console.log("DEF: Executing user code with input", input);
		const storedValue = await storage.get("key");
		console.log("stored value:", storedValue);
		await storage.set("key", storedValue + 1);
	};

	let storageEventId = 0;

	const storageGetEventListeners = new Map<number, Listener>();
	const storageSetEventListeners = new Map<number, Listener<void>>();

	const storage: ExecutorStorage = {
		get: async (key: string) => {
			const eventId = storageEventId++;
			const message: GetStorageValueMessage = {
				messageType: "evalClientMessage",
				action: "getStorageValue",
				key,
				id: eventId,
			};

			const promise = new Promise((resolve, reject) => {
				storageGetEventListeners.set(eventId, { resolve, reject });
			});

			top.postMessage(message);

			return promise;
		},
		set: async (key: string, value: any) => {
			const eventId = storageEventId++;
			const message: SetStorageValueMessage = {
				messageType: "evalClientMessage",
				action: "setStorageValue",
				key,
				value,
				id: eventId,
			};

			const promise = new Promise<void>((resolve, reject) => {
				storageSetEventListeners.set(eventId, { resolve, reject });
			});

			top.postMessage(message);

			return promise;
		},
	};

	window.addEventListener(
		"message",
		async (event: MessageEvent<ClientMessage>) => {
			const eventData = event.data;

			if (eventData.messageType !== "evalServerMessage") {
				return;
			}

			switch (eventData.action) {
				case "setFunction": {
					const { value } = eventData;
					userCode = new Function(`return ${value}`)();
					break;
				}
				case "callFunction": {
					const { input, id } = eventData;
					try {
						const result = await userCode(input, storage);
						const response: CallResponseMessage = {
							messageType: "evalClientMessage",
							action: "callResponse",
							id,
							success: true,
							value: result,
						};
						top.postMessage(response);
					} catch (e) {
						const response: CallResponseMessage = {
							messageType: "evalClientMessage",
							action: "callResponse",
							id,
							success: false,
							error: formatError(e),
						};
						top.postMessage(response);
					}
					break;
				}
				case "getStorageValueResponse": {
					const listeners = storageGetEventListeners.get(eventData.id);
					if (listeners) {
						if (eventData.success) {
							listeners.resolve(eventData.value);
						} else {
							listeners.reject(eventData.error);
						}
					}
					break;
				}
				case "setStorageValueResponse": {
					const listeners = storageSetEventListeners.get(eventData.id);
					if (listeners) {
						if (eventData.success) {
							listeners.resolve();
						} else {
							listeners.reject(eventData.error);
						}
					}
					break;
				}
			}
		},
	);
};
