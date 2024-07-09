import type { Canvas, CanvasTextNode } from "~/shared/types";
import type { AIEnabledNodeData } from "~/types/LunixNodeData";

export const getParent = (
	canvas: Canvas,
	target: CanvasTextNode,
): CanvasTextNode<AIEnabledNodeData> | null => {
	const edges = Array.from(canvas.edgeTo.get(target) ?? []);

	if (edges.length > 0) {
		return edges[0].from.node;
	}

	return null;
};
