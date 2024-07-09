type SetFunctionMessage = BaseEvalServerMessage & {
	action: "setFunction";
	value: string;
};

export type CallFunctionMessage = BaseEvalServerMessage & {
	action: "callFunction";
	id: number;
	input: any;
};

export type GetStorageValueResponseMessage = BaseEvalServerMessage &
	(
		| {
				action: "getStorageValueResponse";
				id: number;
				success: true;
				value: any;
		  }
		| {
				action: "getStorageValueResponse";
				id: number;
				success: false;
				error: string;
		  }
	);

export type SetStorageValueResponseMessage = BaseEvalServerMessage &
	(
		| {
				action: "setStorageValueResponse";
				id: number;
				success: true;
		  }
		| {
				action: "setStorageValueResponse";
				id: number;
				success: false;
				error: string;
		  }
	);

type BaseEvalClientMessage = {
	messageType: "evalClientMessage";
};

type BaseEvalServerMessage = {
	messageType: "evalServerMessage";
};

export type ClientMessage =
	| SetFunctionMessage
	| CallFunctionMessage
	| GetStorageValueResponseMessage
	| SetStorageValueResponseMessage;

export type CallResponseMessage = BaseEvalClientMessage &
	(
		| {
				action: "callResponse";
				id: number;
				success: true;
				value: any;
		  }
		| {
				action: "callResponse";
				id: number;
				success: false;
				error: string;
		  }
	);

export type GetStorageValueMessage = BaseEvalClientMessage & {
	action: "getStorageValue";
	id: number;
	key: string;
};

export type SetStorageValueMessage = BaseEvalClientMessage & {
	action: "setStorageValue";
	id: number;
	key: string;
	value: any;
};

type IframeLoadedMessage = BaseEvalClientMessage & {
	action: "iframeLoaded";
};

export type ServerMessage =
	| CallResponseMessage
	| GetStorageValueMessage
	| SetStorageValueMessage
	| IframeLoadedMessage;
