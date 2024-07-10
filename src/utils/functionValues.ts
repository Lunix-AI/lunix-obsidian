import type {FunctionKeys} from "~/utils/functionKeys";

export type FunctionValues<T extends object> = {
	[K in FunctionKeys<T>]: T[K];
};
