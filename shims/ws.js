export const WebSocket = class extends window.WebSocket {
	on(event, callback) {
		switch (event) {
			case "open":
				super.onopen = (e) => callback(e);
				break;
			case "message":
				super.onmessage = (e) => callback(e.data);
				break;
			case "close":
				super.onclose = (e) => callback(e);
				break;
			case "error":
				super.onerror = (e) => callback(e);
				break;
		}
	}
};
