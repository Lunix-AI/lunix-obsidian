import type { App, TFile } from "obsidian";
import type { CanvasTextNode } from "~/shared/types";
import type { AIEnabledNodeData } from "~/types/LunixNodeData";

type FileProperties = Record<string, any>;

export type BasicFileInfo<TProperties extends FileProperties = FileProperties> =
	{
		properties: TProperties;
		contents: string;
	};

export const getBasicFileInfo = async <
	TProperties extends FileProperties = FileProperties,
>(
	app: App,
	file: TFile,
): Promise<BasicFileInfo<TProperties>> => {
	const fileContents = (await app.vault.cachedRead(file)).trim();

	let properties: TProperties = {} as TProperties;

	await app.fileManager.processFrontMatter(file, (matter) => {
		// console.log(`front matter: ${JSON.stringify(matter, null, 2)}`);
		properties = { ...properties, ...matter };
	});

	if (fileContents.startsWith("---")) {
		const propertiesRegex = /---\n([\s\S]*?)\n---/;
		const propertiesMatch = propertiesRegex.exec(fileContents);

		if (propertiesMatch) {
			const contents = fileContents.replace(propertiesMatch[0], "").trim();

			return { properties, contents };
		}
	}

	return { properties, contents: fileContents };
};

export const getNodeText = async (app: App, node: CanvasTextNode) => {
	const data = node.getData();

	if (node.child?.editor) {
		return node.child.editor.getValue();
	}

	if (data.type === "file") {
		const file = app.vault.getFileByPath(data.file);
		if (!file) {
			return null;
		}

		return await getBasicFileInfo(app, file).then(({ contents }) => contents);
	}

	if (data.type === "text") {
		return data.text;
	}
};
