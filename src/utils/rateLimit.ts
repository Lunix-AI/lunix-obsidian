export const rateLimit = <T extends (...args: any[]) => any>(fn: T, timeBetween: number): T => {
	let lastTime = 0;
	return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
		if (Date.now() - lastTime < timeBetween) {
			await new Promise(r => setTimeout(r, timeBetween));
		}

		lastTime = Date.now();

		return fn(...args);
	}) as T;
}
