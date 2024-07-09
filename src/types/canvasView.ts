import type {FileView} from "obsidian";
import type {Canvas} from "~/shared/types";

export interface CanvasView extends FileView {
	canvas: Canvas;
}
