import type { WebContents } from "electron";
import type {
	App,
	Component,
	Editor,
	EventRef,
	Menu,
	Point,
	TFile,
	View,
	Workspace,
} from "obsidian";
import type {
	AllCanvasNodeData,
	CanvasData,
	CanvasEdgeData,
	NodeSide,
} from "obsidian/canvas";

export const ExtendedSymbol = Symbol("Extended");
export const ResetSymbol = Symbol("Reset");

export type NodeInteractionLayerPrototype = {
	setTarget: (node: CanvasTextNode) => void;
	render: () => void;
	startEditing: () => void;
	[ExtendedSymbol]?: boolean;
};

export type NodeInteractionLayer = {
	target: null | CanvasTextNode;
	interactionEl: HTMLDivElement;
} & NodeInteractionLayerPrototype;

export type CanvasPrototype = {
	/*
applyHistory: ƒ (e)
canSnap: ƒ (e)
cancelFrame: ƒ ()
clear: ƒ ()
clearSnapPoints: ƒ ()
cloneData: ƒ (e,t)
createFileNode: ƒ (e)
createFileNodes: ƒ (e,t)
createGroupNode: ƒ (e)
createLinkNode: ƒ (e)
createPlaceholder: ƒ ()
deleteSelection: ƒ ()
deselect: ƒ (e)
deselectAll: ƒ ()
domFromPos: ƒ (e)
domPosFromClient: ƒ (e)
domPosFromEvt: ƒ (e)
dragTempNode: ƒ (e,t,n)
endSnapPointRendering: ƒ ()
generateHDImage: ƒ ()
getContainingNodes: ƒ (e)
getData: ƒ ()
getEdgesForNode: ƒ (e)
getIntersectingEdges: ƒ (e)
getIntersectingNodes: ƒ (e)
getSelectionData: ƒ (e)
getSnapping: ƒ (e,t,n,i)
getState: ƒ ()
getViewportBBox: ƒ ()
getViewportNodes: ƒ (e)
getZIndex: ƒ ()
handleCopy: ƒ (e)
handleCut: ƒ (e)
handleDragToSelect: ƒ (e,t,n)
handleDragWithPan: ƒ (e,t)
handleMoverPointerdown: ƒ (e)
handlePaste: ƒ (e)
handleSelectionDrag: ƒ (e,t,n)
hitTestNode: ƒ (e,t)
importData: ƒ (e,t)
interactionHitTest: ƒ (e)
load: ƒ ()
markDirty: ƒ (e)
markMoved: ƒ (e)
markViewportChanged: ƒ ()
nudgeSelection: ƒ (e,t)
onContextMenu: ƒ (e)
onDoubleClick: ƒ (e)
onKeydown: ƒ (e)
onPointerdown: ƒ (e)
onPointermove: ƒ (e)
onPriorityPointerdown: ƒ (e)
onResize: ƒ ()
onSelectionContextMenu: ƒ (e)
onTouchdown: ƒ (e)
onWheel: ƒ (e)
overrideHistory: ƒ ()
panBy: ƒ (e,t)
panIntoView: ƒ (e,t)
panTo: ƒ (e,t)
posCenter: ƒ ()
posFromClient: ƒ (e)
posFromDom: ƒ (e)
posFromEvt: ƒ (e)
posInViewport: ƒ (e)
pushHistory: ƒ (e)
redo: ƒ ()
renderSnapPoints: ƒ (e,t,n,i)
requestFrame: ƒ (e)
rerenderViewport: ƒ ()
select: ƒ (e)
selectAll: ƒ (e)
selectOnly: ƒ (e)
setData: ƒ (e)
setDragging: ƒ (e)
setReadonly: ƒ (e)
setState: ƒ (e)
setViewport: ƒ (e,t,n)
showCreationMenu: ƒ (e,t,n)
showQuickSettingsMenu: ƒ (e)
smartZoom: ƒ (e)
takeScreenshot: ƒ (e,t)
toggleGridSnapping: ƒ (e)
toggleObjectSnapping: ƒ (e)
toggleSelect: ƒ (e)
undo: ƒ ()
unload: ƒ ()
updateFileOpen: ƒ (e)
updateHistoryUI: ƒ ()
updateSelection: ƒ (e)
virtualize: ƒ ()
zoomBy: ƒ (e,t)
zoomToBbox: ƒ (e)
zoomToFit: ƒ ()
zoomToSelection: ƒ ()
 */
	addEdge: (edge: CanvasEdgeData) => void;
	addNode: (node: CanvasTextNode) => CanvasTextNode;
	requestSave: () => void;
	getData(): CanvasData;
	setData(data: CanvasData): void;
	removeNode: (node: CanvasTextNode) => void;
	removeEdge: (node: CanvasEdge) => void;
	createTextNode: <TData extends AllCanvasNodeData = AllCanvasNodeData>(args: {
		pos: Point;
		text?: string;
		size?: Size;
		focus?: boolean;
	}) => CanvasTextNode<TData>;
	/*     e.prototype.createFileNode = function(e) {
                var t = e.pos
                  , n = e.size
                  , i = e.position
                  , r = e.file
                  , o = e.subpath
                  , a = e.save
                  , s = e.focus
                  , l = new hJ(this);
                return n || (n = this.config.defaultFileNodeDimensions),
                l.moveAndResize(oQ(t, n, i)),
                l.setFile(r, o),
                this.addNode(l),
                !1 !== a && this.requestSave(),
                !1 !== s && this.selectOnly(l),
                l
            }*/
	createFileNode: (args: {
		pos: Point;
		size?: Size;
		position?: Point;
		file: TFile;
		subpath: string;
		save?: boolean;
		focus?: boolean;
	}) => CanvasTextNode;
	showCreationMenu: (menu: Menu, pos: Point, size?: Size) => void;
	importData: (data: CanvasData, remove?: boolean) => void;
	selectOnly: (node: CanvasTextNode) => void;
	deselect: (node: CanvasTextNode) => void;
	zoomToSelection: () => void;
	rerenderViewport: () => void;
	getIntersectingNodes: (bbox: CanvasBBox) => Set<CanvasTextNode>;
	requestFrame: () => void;
	markDirty: (node: CanvasTextNode) => void;
	// generateHDImage: () => unknown;
	[ExtendedSymbol]?: boolean;
};

export type CanvasMenuPrototype = {
	render: () => unknown;
	[ExtendedSymbol]?: boolean;
	[ResetSymbol]?: () => void;
};

export type CanvasMenu = {
	containerEl: HTMLDivElement;
	selection: {
		bbox: CanvasBBox;
		canvas: Canvas;
	};
	menuEl: HTMLDivElement;
} & CanvasMenuPrototype;

export type EdgeMap = {
	add: (node: CanvasTextNode, edge: CanvasEdge) => void;
	delete: (node: CanvasTextNode, edge: CanvasEdge) => void;
	get: (node: CanvasTextNode) => Set<CanvasEdge>;
	getArray: (node: CanvasTextNode) => CanvasEdge[];
	data: Map<CanvasTextNode, Set<CanvasEdge>>;
};

export type Canvas = {
	menu: CanvasMenu;
	nodeInteractionLayer: NodeInteractionLayer;
	nodes: Map<AllCanvasNodeData["id"], CanvasTextNode>;
	edges: Map<CanvasEdgeData["id"], CanvasEdge>;
	data: CanvasData;
	view: View;
	pointer: Point;
	app: App;
	selection: Set<CanvasTextNode>;
	edgeTo: EdgeMap;
	edgeFrom: EdgeMap;
	wrapperEl: HTMLDivElement & {
		win: {
			electron: {
				remote: {
					getCurrentWebContents(): WebContents;
				};
			};
		};
	};
	[ExtendedSymbol]?: boolean;
	[ResetSymbol]?: () => void;
} & CanvasPrototype;

export type CanvasNodeBasePrototype<
	TData extends AllCanvasNodeData = AllCanvasNodeData,
> = {
	blur: () => void;
	destroy: () => void;
	focus: () => void;
	initialize: () => void;
	isEditable: () => boolean;
	moveAndResize: (params: {
		x: number;
		y: number;
		width: number;
		height: number;
	}) => void;
	onResizeDblclick: (e: MouseEvent, n: "bottom") => void;
	render: () => void;
	startEditing: () => void;
	// one level higher
	attach: () => void;
	detach: () => void;
	getData: () => TData;
	mountContent: () => void;
	resize: (params: { width: number; height: number }) => void;
	setColor: (color: string) => void;
	setData: (data: Partial<TData>) => void;
	setIsEditing: (isEditing: boolean) => void;
};

export type CanvasTextNodePrototype<
	TData extends AllCanvasNodeData = AllCanvasNodeData,
> = CanvasNodeBasePrototype<TData> & {
	setText: (text: string) => void;
	[ExtendedSymbol]?: boolean;
	[ResetSymbol]?: () => void;
};

export type CanvasFileNodePrototype<
	TData extends AllCanvasNodeData = AllCanvasNodeData,
> = CanvasNodeBasePrototype<TData> & {
	setFile: (file: TFile, subpath: string) => void;
	[ExtendedSymbol]?: boolean;
	[ResetSymbol]?: () => void;
};

export type CanvasTextNode<
	TData extends AllCanvasNodeData = AllCanvasNodeData,
> = {
	x: number;
	y: number;
	width: number;
	height: number;
	bbox: CanvasBBox;
	nodeEl?: HTMLDivElement;
	containerEl?: HTMLDivElement;
	contentEl?: HTMLDivElement;
	get destroyed(): boolean;
	canvas: Canvas;
	alwaysKeepLoaded: boolean;
	color: string;
	child?: Component & {
		editor?: Editor;
	};
} & CanvasTextNodePrototype<TData>;

export type CanvasFileNode<
	TData extends AllCanvasNodeData = AllCanvasNodeData,
> = {
	// x: number;
	// y: number;
	// width: number;
	// height: number;
	// bbox: CanvasBBox;
	// nodeEl?: HTMLDivElement;
	// containerEl?: HTMLDivElement;
	// contentEl?: HTMLDivElement;
	// get destroyed(): boolean;
	// canvas: Canvas;
	// alwaysKeepLoaded: boolean;
	// color: string;
	// child?: Component & {
	// 	editor?: Editor;
	// };
	contentEl?: HTMLDivElement;
	canvas: Canvas;
} & CanvasFileNodePrototype<TData>;

export type CanvasEdge = {
	getData: () => CanvasEdgeData;
	from: { side: NodeSide; node: CanvasTextNode; end: NodeSide };
	to: { side: NodeSide; node: CanvasTextNode; end: NodeSide };
	update: (
		from: { side: NodeSide; node: CanvasTextNode; end: NodeSide },
		to: { side: NodeSide; node: CanvasTextNode; end: NodeSide },
	) => void;
	[key: string]: any;
};

export type Size = { width: number; height: number };

export type CanvasBBox = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

export type WorkspaceWithCanvas = {
	on(
		name: "canvas:creation-menu",
		callback: (menu: Menu, canvas: Canvas, pos: Point, size?: Size) => any,
		ctx?: any,
	): EventRef;
	on(
		name: "canvas:node:initialize",
		callback: (node: CanvasTextNode) => any,
		ctx?: any,
	): EventRef;
	on(
		name: "canvas:node-menu",
		callback: (menu: Menu, node: CanvasTextNode) => any,
		ctx?: any,
	): EventRef;
	on(
		name: "canvas:node-connection-drop-menu",
		callback: (menu: Menu, from: CanvasTextNode, edge: CanvasEdge) => any,
		ctx?: any,
	): EventRef;
	on(
		name: "canvas:edge-menu",
		callback: (menu: Menu, edge: CanvasEdge) => any,
		ctx?: any,
	): EventRef;
	on(
		name: "canvas:selection-menu",
		callback: (menu: Menu, canvas: Canvas) => any,
		ctx?: any,
	): EventRef;
	on(name: "canvas:menu:render", callback: () => any, ctx?: any): EventRef;
	on(
		name: "canvas:node-interaction-layer:render",
		callback: () => any,
		ctx?: any,
	): EventRef;
	on(
		name: "canvas:node-interaction-layer:set-target",
		callback: (node: CanvasTextNode) => any,
		ctx?: any,
	): EventRef;
} & Workspace;
