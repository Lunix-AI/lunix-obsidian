import type { Point } from "obsidian";
import type { CanvasData, NodeSide } from "obsidian/canvas";
import type { Canvas, CanvasTextNode, Size } from "~/shared/types";
import { AIEnabledNodeData, type LunixNodeData } from "~/types/LunixNodeData";

const horizontalGap = 150;

export enum CanvasItemColor {
	Default = "",
	Gray = "0",
	Red = "1",
	Orange = "2",
	Yellow = "3",
	Green = "4",
	Cyan = "5",
	Purple = "6",
}

// Define all possible valid strings
type HashString = `#${string}`;

export type AddNeighbourOptions = {
	referenceNode?: CanvasTextNode;
	edgeColor?: CanvasItemColor | HashString;
	offset?: Point;
};

export const tryAddNeighbour = async <TData extends LunixNodeData>(
	canvas: Canvas,
	node: CanvasTextNode,
	gap: number,
	focus = false,
	options?: AddNeighbourOptions,
): Promise<CanvasTextNode<TData>> => {
	// console.log(tryAddNeighbour.name, options);
	const relevantNode = options?.referenceNode ?? node;

	const pos: Point = options?.offset
		? {
				x: relevantNode.x + options.offset.x,
				y: relevantNode.y + options.offset.y,
			}
		: {
				x: relevantNode.x,
				y: relevantNode.y + relevantNode.height + gap,
			};

	const size: Size = {
		width: relevantNode.width,
		height: gap,
	};

	let canPlace = false;

	while (!canPlace) {
		const intersections = Array.from(
			canvas.getIntersectingNodes({
				minX: pos.x,
				minY: pos.y,
				maxX: pos.x + size.width,
				maxY: pos.y + size.height + 1500,
			}),
		);

		if (intersections.length === 0) {
			canPlace = true;
		} else {
			pos.x = Math.max(
				...intersections.map((node) => node.x + node.width + horizontalGap),
			);
		}
	}

	const newNode = canvas.createTextNode<TData>({
		pos,
		text: "",
		size,
		focus,
	});

	const newNodeData = newNode.getData();

	const inputNodeId = newNodeData.id;

	let wantedSide: NodeSide = "bottom";

	if (pos.x > node.x + node.width) {
		wantedSide = "right";
	} else if (pos.x + size.width < node.x) {
		wantedSide = "left";
	}

	const edgeColor = options?.edgeColor ?? CanvasItemColor.Default;

	let wantedToSide: NodeSide =
		wantedSide === "bottom" ? "top" : wantedSide === "right" ? "left" : "right";

	// if the next node is below the current node, we want to connect the bottom of the current node to the top of the next node
	if (pos.y > node.y + node.height * 0.5) {
		// but only if the next node is not to the left of the current node
		if (pos.x + size.width * 0.5 > node.x) {
			wantedToSide = "top";
		}
	}

	canvas.importData({
		edges: [
			{
				id: `${node.getData().id}->${inputNodeId}`,
				fromNode: node.getData().id,
				fromSide: wantedSide,
				toNode: inputNodeId,
				toSide: wantedToSide,
				color: edgeColor,
			},
		],
		nodes: [],
	} satisfies CanvasData);

	canvas.requestSave();

	return newNode;
};
