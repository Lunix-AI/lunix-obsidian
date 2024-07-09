import { createEvent, createStore, merge, sample } from "effector";
import type { Menu, Point, TFile } from "obsidian";
import { once } from "patronum";
import type { Canvas, CanvasEdge, CanvasTextNode, Size } from "~/shared/types";

export const canvasLoaded = createEvent<{ canvas: Canvas; file: TFile }>();

export const onCreationMenu = createEvent<{
	menu: Menu;
	pos: Point;
	size?: Size;
	canvas: Canvas;
}>();
export const onSelectionMenu = createEvent<{ menu: Menu; canvas: Canvas }>();
export const onNodeMenu = createEvent<{ menu: Menu; node: CanvasTextNode }>();
export const onNodeInitialized = createEvent<{ node: CanvasTextNode }>();
export const onEdgeMenu = createEvent<{ menu: Menu; edge: CanvasEdge }>();
export const onConnectionMenu = createEvent<{
	menu: Menu;
	from: CanvasTextNode;
	edge: CanvasEdge;
}>();

export const onMenuRender = createEvent();
export const onNodeInteractionLayerRender = createEvent();
export const onNodeInteractionLayerSetTarget = createEvent<{
	target: CanvasTextNode;
}>();

export const $canvas = createStore<Canvas | null>(null);
export const $canvasFile = createStore<TFile | null>(null);

/** Last target node */
export const $node = createStore<CanvasTextNode | null>(null);

sample({
	clock: canvasLoaded,
	fn: ({ canvas }) => canvas,
	target: $canvas,
});
sample({
	clock: canvasLoaded,
	source: $canvasFile,
	filter: (prev, { file }) => prev?.path !== file?.path,
	fn: (_, { file }) => file,
	target: $canvasFile,
});

const renderCanvasMenu = createEvent<boolean>();

{
	sample({
		clock: onMenuRender,
		source: $canvas,
		fn: (canvas) => canvas?.menu.containerEl.parentElement !== null,
		target: renderCanvasMenu,
	});
	sample({
		clock: renderCanvasMenu,
		source: $canvas,
		filter: (_, hasParent) => hasParent,
		fn: (canvas) =>
			canvas?.selection.size === 1
				? canvas?.selection.values().next()?.value ?? null
				: null,
		target: $node,
	});
}

export const initCanvasMenu = once({
	source: sample({
		clock: renderCanvasMenu,
		filter: (hasParent) => hasParent,
	}),
	reset: merge([
		sample({
			clock: renderCanvasMenu,
			filter: (hasParent) => !hasParent,
		}),
		$node,
	]),
});
