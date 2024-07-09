export interface ThinkingBlock {
	type: "thinking";
	content: string;
	startIndex: number;
	endIndex: number;
}

export interface ArtifactBlock {
	type: "artifact";
	identifier: string;
	title?: string;
	contentType?: string;
	language?: string;
	content: string;
	startIndex: number;
	endIndex: number;
}

export type ArtifactMetaBlock = ThinkingBlock | ArtifactBlock;

export const processArtifactBlocks = (input: string): ArtifactMetaBlock[] => {
	const blocks: ArtifactMetaBlock[] = [];
	const regex =
		/<ant(Thinking|Artifact)(?:\s+([^>]+))?>([\s\S]*?)(?:<\/ant\1>|$)/gi;

	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	while ((match = regex.exec(input)) !== null) {
		const [fullMatch, type, attributes, content] = match;
		const startIndex = match.index;
		const endIndex = startIndex + fullMatch.length;

		if (type.toLowerCase() === "thinking") {
			blocks.push({
				type: "thinking",
				content: content.trim(),
				startIndex,
				endIndex,
			});
		} else if (type.toLowerCase() === "artifact") {
			const artifactBlock: ArtifactBlock = {
				type: "artifact",
				identifier: "",
				content: content.trim(),
				startIndex,
				endIndex,
			};

			if (attributes) {
				const attributeRegex = /(\w+)="([^"]*)"/g;
				let attrMatch: RegExpExecArray | null;
				// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
				while ((attrMatch = attributeRegex.exec(attributes)) !== null) {
					const [, key, value] = attrMatch;
					switch (key.toLowerCase()) {
						case "identifier":
							artifactBlock.identifier = value;
							break;
						case "title":
							artifactBlock.title = value;
							break;
						case "type":
							artifactBlock.contentType = value;
							break;
						case "language":
							artifactBlock.language = value;
							break;
					}
				}
			}

			if (artifactBlock.identifier) {
				blocks.push(artifactBlock);
			}
		}
	}

	blocks.sort((a, b) => a.startIndex - b.startIndex);

	return blocks;
};

export const formatBlock = (block: ArtifactMetaBlock): string => {
	switch (block.type) {
		case "thinking":
			return `> [!info] Thinking\n${block.content
				.split("\n")
				.map((line) => `> ${line}`)
				.join("\n")}`;
		case "artifact": {
			const title = block.title || "Artifact";
			return `> [!example] ${title}
> \`\`\`
${block.content
	.split("\n")
	.map((line) => {
		return `> ${line}`;
	})
	.join("\n")}
> \`\`\``;
		}
	}
};

export const replaceBlocks = (
	input: string,
	blocks: ArtifactMetaBlock[],
): string => {
	let result = input;
	const sortedBlocks = blocks.sort((a, b) => b.startIndex - a.startIndex);

	for (const block of sortedBlocks) {
		const replacement = formatBlock(block);
		result =
			result.slice(0, block.startIndex) +
			replacement +
			result.slice(block.endIndex);
	}

	return result;
};
