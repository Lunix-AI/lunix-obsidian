// noinspection JSVoidFunctionReturnValueUsed

import { around } from "monkey-around";
import type { Plugin } from "obsidian";
import {
	type Canvas,
	type CanvasFileNode,
	type CanvasFileNodePrototype,
	type CanvasMenu,
	type CanvasMenuPrototype,
	type CanvasNodeBasePrototype,
	type CanvasPrototype,
	type CanvasTextNode,
	type CanvasTextNodePrototype,
	ExtendedSymbol,
	type NodeInteractionLayer,
	type NodeInteractionLayerPrototype,
	ResetSymbol,
} from "~/shared/types";
import type { FunctionValues } from "~/utils/functionValues";
import { TypedEvents } from "~/utils/typedEvents";

type Params<T> = T extends (...args: infer U) => any ? U : never;
type Return<T> = T extends (...args: any[]) => infer U ? U : never;

type PickEvents<
	T extends object,
	U extends string & keyof FunctionValues<T>,
	TPrefix extends string,
> = {
	[K in keyof Pick<FunctionValues<T>, U> as `${TPrefix}:${K}`]: (
		self: T,
		result: Return<Pick<FunctionValues<T>, U>[K]>,
		...args: Params<Pick<FunctionValues<T>, U>[K]>
	) => void;
};

// pick around events is like PickEvents, but instead of accepting a `result` parameter, it accepts a `next` function
// so that we can decide whether to call the original function or not

type PickAroundEvents<
	T extends object,
	U extends string & keyof FunctionValues<T>,
	TPrefix extends string,
> = {
	[K in keyof Pick<FunctionValues<T>, U> as `${TPrefix}:${K}`]: (
		self: T,
		next: Pick<FunctionValues<T>, U>[K],
		...args: Params<Pick<FunctionValues<T>, U>[K]>
	) => void;
};

export type CanvasEventTypes = {} & PickEvents<
	Canvas,
	"showCreationMenu",
	"canvas"
> &
	PickEvents<CanvasMenu, "render", "canvas:menu"> &
	PickEvents<
		NodeInteractionLayer,
		"render" | "setTarget",
		"canvas:nodeInteractionLayer"
	> &
	PickEvents<
		CanvasNodeBasePrototype,
		"initialize" | "render" | "mountContent" | "attach" | "detach",
		"canvas:node"
	> &
	PickEvents<CanvasFileNode, "setFile", "canvas:node"> &
	PickAroundEvents<CanvasTextNode, "startEditing", "canvas:node">;

class CanvasEvents extends TypedEvents<CanvasEventTypes> {}

export const canvasEvents = new CanvasEvents();

export function extendCanvas({
	canvas,
	plugin,
}: {
	canvas: Canvas;
	plugin: Plugin;
}) {
	if (canvas[ExtendedSymbol]) {
		return false;
	}

	const resetActions: Array<() => void> = [
		() => {
			console.log("Resetting canvas!");
		},
	];

	canvas[ExtendedSymbol] = true;
	canvas[ResetSymbol] = () => {
		console.log("Resetting canvas!!!");
		for (const action of resetActions) {
			action();
		}
		canvas[ExtendedSymbol] = false;
		delete canvas[ResetSymbol];
		delete canvas[ExtendedSymbol];
	};

	const canvasPrototype = Object.getPrototypeOf(canvas) as CanvasPrototype;

	console.log("canvasPrototype", canvasPrototype);
	console.log("canvas", canvas);

	if (!canvasPrototype[ExtendedSymbol]) {
		canvasPrototype[ExtendedSymbol] = true;

		const uninstallCanvasPrototype = around(canvasPrototype, {
			showCreationMenu: (originalFunc) => {
				return function (
					this: Canvas,
					...args: Parameters<CanvasPrototype["showCreationMenu"]>
				) {
					const result = originalFunc.apply(this, args);

					canvasEvents.trigger(
						"canvas:showCreationMenu",
						this,
						result,
						...args,
					);

					return result;
				};
			},
		});

		resetActions.push(() => {
			uninstallCanvasPrototype();

			delete canvasPrototype[ExtendedSymbol];
		});
	}

	const nodeInteractionLayerPrototype = Object.getPrototypeOf(
		canvas.nodeInteractionLayer,
	) as NodeInteractionLayerPrototype;

	if (!nodeInteractionLayerPrototype[ExtendedSymbol]) {
		for (const prop of ["render", "setTarget"] satisfies Array<
			keyof NodeInteractionLayerPrototype
		>) {
			const originalFunc = nodeInteractionLayerPrototype[prop];
			nodeInteractionLayerPrototype[prop] = new Proxy(originalFunc, {
				apply: (
					target,
					thisArg: NodeInteractionLayer,
					argumentsList: Parameters<typeof originalFunc>,
				) => {
					canvasEvents.trigger(
						`canvas:nodeInteractionLayer:${prop}`,
						thisArg,
						target as any,
						...argumentsList,
					);

					return Reflect.apply(target, thisArg, argumentsList);
				},
			}) as any;

			resetActions.push(() => {
				console.log(`Resetting nodeInteractionLayer:${prop}!`);
				nodeInteractionLayerPrototype[prop] = originalFunc as any;
			});
		}

		resetActions.push(() => {
			console.log("Resetting nodeInteractionLayer!");

			nodeInteractionLayerPrototype[ExtendedSymbol] = false;
			delete nodeInteractionLayerPrototype[ExtendedSymbol];
		});
	}

	const menuPrototype = Object.getPrototypeOf(
		canvas.menu,
	) as CanvasMenuPrototype;

	if (!menuPrototype[ExtendedSymbol]) {
		const originalRender = menuPrototype.render;

		menuPrototype.render = new Proxy(originalRender, {
			apply: (target, thisArg, argumentsList) => {
				const result = Reflect.apply(target, thisArg, argumentsList);

				canvasEvents.trigger("canvas:menu:render", thisArg, result);

				return result;
			},
		});

		resetActions.push(() => {
			console.log("Resetting menu:render!");
			menuPrototype.render = originalRender;
		});

		menuPrototype[ExtendedSymbol] = true;

		resetActions.push(() => {
			console.log("Resetting menu!");
			menuPrototype[ExtendedSymbol] = false;
			delete menuPrototype[ExtendedSymbol];
		});
	}

	const textNodePrototype = getTextNodePrototype(canvas);

	if (!textNodePrototype[ExtendedSymbol]) {
		for (const prop of [
			"initialize",
			"render",
			"mountContent",
			"attach",
			"detach",
		] satisfies Array<keyof CanvasNodeBasePrototype>) {
			const original = textNodePrototype[prop];

			textNodePrototype[prop] = new Proxy(original, {
				apply: (
					target,
					thisArg: CanvasTextNode,
					argumentsList: Parameters<typeof original>,
				) => {
					const result = Reflect.apply(target, thisArg, argumentsList);

					canvasEvents.trigger(
						`canvas:node:${prop}`,
						thisArg,
						result,
						...argumentsList,
					);

					return result;
				},
			}) as any;

			resetActions.push(() => {
				console.log(`Resetting node:${prop}!`);
				textNodePrototype[prop] = original;
			});
		}

		const fileNodePrototype = getFileNodePrototype(canvas);

		const setFileOwner = fileNodePrototype as Pick<
			CanvasFileNodePrototype,
			"setFile"
		>;

		for (const prop of ["setFile"] satisfies Array<
			keyof CanvasFileNodePrototype
		>) {
			if (prop === "setFile") {
				console.log("setting setFile?", setFileOwner, setFileOwner[prop]);
			}

			const original = setFileOwner[prop];

			setFileOwner[prop] = new Proxy(original, {
				apply: (
					target,
					thisArg: CanvasFileNode,
					argumentsList: Parameters<typeof original>,
				) => {
					const result = Reflect.apply(target, thisArg, argumentsList);

					console.log("setFile...", thisArg, result, argumentsList);

					canvasEvents.trigger(
						`canvas:node:${prop}`,
						thisArg,
						result,
						...argumentsList,
					);

					return result;
				},
			}) as any;

			resetActions.push(() => {
				console.log(`Resetting node:${prop}!`);
				setFileOwner[prop] = original;
			});
		}

		for (const prop of ["startEditing"] satisfies Array<
			keyof CanvasNodeBasePrototype
		>) {
			const uninstall = around(textNodePrototype, {
				[prop]: (originalFunc) => {
					return function (
						this: CanvasTextNode,
						...args: Parameters<CanvasNodeBasePrototype["startEditing"]>
					) {
						const next = (...newArgs: Parameters<typeof originalFunc>) =>
							Reflect.apply(originalFunc, this, newArgs);

						if (canvasEvents.hasListeners(`canvas:node:${prop}`)) {
							canvasEvents.trigger(`canvas:node:${prop}`, this, next, ...args);
						} else {
							return next(...args);
						}
					};
				},
			});

			resetActions.push(() => {
				console.log(`Resetting around node:${prop}.`);
				uninstall();
			});
		}

		resetActions.push(() => {
			console.log("Resetting node!");
			textNodePrototype[ExtendedSymbol] = false;
			delete textNodePrototype[ExtendedSymbol];
		});
	}

	return true;
}

export function getTextNodePrototype(canvas: Canvas) {
	const node = canvas.createTextNode({ pos: { x: 0, y: 0 } });
	const nodePrototype: CanvasTextNodePrototype = Object.getPrototypeOf(node);

	canvas.removeNode(node);
	canvas.requestSave();

	return nodePrototype;
}

export function getFileNodePrototype(canvas: Canvas) {
	const node = canvas.createFileNode({
		pos: { x: 0, y: 0 },
		file: {
			name: "test",
			basename: "test",
			extension: "txt",
			parent: null,
			path: "test",
			stat: {
				size: 0,
				mtime: 0,
				ctime: 0,
			},
			vault: canvas.app.vault,
		},
		subpath: "test",
	});

	const nodePrototype: CanvasFileNodePrototype = Object.getPrototypeOf(node);

	canvas.removeNode(node);
	canvas.requestSave();

	return nodePrototype;
}
