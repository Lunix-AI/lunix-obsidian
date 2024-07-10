import {type EventRef, Events} from "obsidian";

export class TypedEvents<
	TEvents extends {
		[key: string]: (...args: any[]) => any;
	},
> extends Events {
	private registerMap: {
		[K in keyof TEvents & string]?: TEvents[K][];
	} = {};

	trigger<K extends keyof TEvents & string>(
		event: K,
		...args: Parameters<TEvents[K]>
	) {
		return super.trigger(event, ...args);
	}

	on<K extends keyof TEvents & string>(event: K, callback: TEvents[K]) {
		this.registerMap[event] = this.registerMap[event] || [];
		this.registerMap[event]!.push(callback);
		const result = super.on(event, callback) as EventRef & {
			e: {
				offref: (ref: EventRef) => void;
			};
		};

		return {
			e: {
				offref: (ref: EventRef) => {
					result.e.offref(ref);
					this.registerMap[event] = this.registerMap[event]!.filter(
						(cb) => cb !== callback,
					);
					if (this.registerMap[event]!.length === 0) {
						delete this.registerMap[event];
					}
				},
			},
		};
	}

	off<K extends keyof TEvents & string>(event: K, callback: TEvents[K]) {
		if (this.registerMap[event]) {
			this.registerMap[event] = this.registerMap[event]!.filter(
				(cb) => cb !== callback,
			);

			if (this.registerMap[event]!.length === 0) {
				delete this.registerMap[event];
			}
		}

		return super.off(event, callback);
	}

	hasListeners<K extends keyof TEvents & string>(event: K) {
		return this.registerMap[event] && this.registerMap[event]!.length > 0;
	}
}
