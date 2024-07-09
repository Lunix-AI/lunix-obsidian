export type Listener<T = any> = {
	resolve: (value: T) => void,
	reject: (reason: any) => void
};
