import type { App } from "obsidian";
import type { Canvas, CanvasTextNode } from "~/shared/types";
import type { AddNeighbourOptions } from "~/tryAddNeighbour";
import type { AIEnabledNodeData } from "~/types/LunixNodeData";

export interface PerformAICompletionParams {
	app: App;
	canvas: Canvas;
	node: CanvasTextNode<AIEnabledNodeData>;
	options?: AddNeighbourOptions;
	mode: "user" | "tool";
}
