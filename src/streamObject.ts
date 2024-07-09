import { Notice } from "obsidian";

export const streamObject = (
	target: Record<string, any>,
	source: Record<string, any>,
) => {
	for (const key in source) {
		if (target[key] !== undefined) {
			if (target[key] === source[key]) {
				continue;
			}

			if (typeof target[key] === "string") {
				target[key] += source[key];
				continue;
			}

			if (typeof target[key] === "object") {
				streamObject(target[key], source[key]);
				continue;
			}

			new Notice(
				`Cannot merge object with key ${key} because it is of type ${typeof target[key]}.`,
			);
		} else {
			target[key] = source[key];
		}
	}
};
