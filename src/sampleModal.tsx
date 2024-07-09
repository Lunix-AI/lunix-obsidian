import {
	type EditorState,
	StateField,
	type Transaction,
} from "@codemirror/state";
import { Modal } from "obsidian";
import { type Root, createRoot } from "react-dom/client";

// export const calculatorField = StateField.define<number>({
// 	create(state: EditorState): number {
// 		console.log("create", state);
// 		return 0;
// 	},
// 	update(oldState: number, transaction: Transaction): number {
// 		const newState = oldState;
//
// 		for (const effect of transaction.effects) {
// 			console.log(effect);
// 			// if (effect.is(addEffect)) {
// 			// 	newState += effect.value;
// 			// } else if (effect.is(subtractEffect)) {
// 			// 	newState -= effect.value;
// 			// } else if (effect.is(resetEffect)) {
// 			// 	newState = 0;
// 			// }
// 		}
//
// 		return newState;
// 	},
// 	fromJSON(json: any, state: EditorState): number {
// 		console.log("fromJSON", json, state);
// 		return json;
// 	},
// });

export class SampleModal extends Modal {
	root: Root | null = null;

	onOpen() {
		const { contentEl, modalEl } = this;

		// console.log("contentEl", contentEl, this);

		modalEl.style.opacity = "0.5";

		// contentEl.setText('Woah!!');
		this.root = createRoot(contentEl);
		// this.root.render(<ArtifactView />);

		// instances.add(this);
	}

	onClose() {
		this.root?.unmount();

		const { contentEl } = this;
		contentEl.empty();

		// instances.delete(this);
	}
}
