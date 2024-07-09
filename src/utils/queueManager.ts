export const withQueue =  <T extends (...args: any[]) => any>(fn: T): T => {
	let isProcessing = false;
	const queue: {
		params: Parameters<T>,
		resolve: (result: Awaited<ReturnType<T>>) => void,
		reject: (error: any) => void,
	}[] = [];

	return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
		return new Promise<ReturnType<T>>((resolve, reject) => {
			queue.push({
				params: args,
				resolve,
				reject,
			});

			processQueue().catch(console.error);
		});
	}) as T;

	async function processQueue() {
		if (queue.length === 0 || isProcessing) {
			return;
		}

		isProcessing = true;

		try {
			const {
				params,
				resolve,
				reject,
			} = queue.shift()!;

			try {
				const result = await fn(...params);
				resolve(result);
			} catch (e) {
				console.error(e);
				reject(e);
			}
		} catch (e) {
			console.error(e);
		} finally {
			isProcessing = false;
			processQueue().catch(console.error);
		}
	}
}
