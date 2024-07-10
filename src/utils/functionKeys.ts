export type FunctionKeys<T extends object> = {
	[K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];
