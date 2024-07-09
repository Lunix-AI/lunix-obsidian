// noinspection JSUnusedLocalSymbols
import type {Canvas} from "~/shared/types";

const takeScreenshot = async (canvas: Canvas) => {
	return (await canvas.wrapperEl.win.electron.remote.getCurrentWebContents().capturePage()).toDataURL();
}
