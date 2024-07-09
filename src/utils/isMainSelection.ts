import type { Canvas, CanvasTextNode } from "~/shared/types";

export function isMainSelection(canvas: Canvas, node: CanvasTextNode) {
	return (
		canvas.selection.size === 1 &&
		canvas.selection.values().next().value === node
	);
}
