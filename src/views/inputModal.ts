import {type App, Modal} from "obsidian";

export class InputModal extends Modal {
	label: string;
	buttonLabel: string;
	inputEl: HTMLInputElement;
	submitted = false;

	constructor(
		app: App,
		{label, buttonLabel}: {
			label: string;
			buttonLabel: string
		},
		private onSubmit: (value: string) => void,
		private onCancel: () => void,
	) {
		super(app);
		this.label = label;
		this.buttonLabel = buttonLabel;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.className = "augmented-canvas-modal-container";

		const inputEl = contentEl.createDiv().createEl("textarea", {
			placeholder: this.label,
			attr: {
				style: 'width: 90%',
			}
		});

		// Add keydown event listener to the textarea
		inputEl.addEventListener("keydown", (event) => {
			// Check if Ctrl + Enter is pressed
			if (event.key === "Enter" && event.ctrlKey) {
				// Prevent default action to avoid any unwanted behavior
				event.preventDefault();
				// Call the onSubmit function and close the modal
				this.onSubmit(inputEl.value);
				this.close();
			}
		});

		// Create and append a submit button
		contentEl.createDiv({
			attr: {
				style: 'margin-top: 10px;'
			}
		}).createEl("button", {
			text: this.buttonLabel,
		}).onClickEvent(() => {
			this.onSubmit(inputEl.value);
			this.close();
		});
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();

		if (!this.submitted) {
			this.onCancel();
		}
	}

	submit() {
		const value = this.inputEl.value;
		this.onSubmit(value);
		this.close();
	}
}
