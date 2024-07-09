import { type App, Notice, base64ToArrayBuffer } from "obsidian";
import OpenAI from "openai";
import { z } from "zod";
import { prepareToolConfig } from "~/toolConfig";

const generateFileName = (prefix = "file"): string => {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = (now.getUTCMonth() + 1).toString().padStart(2, "0");
	const day = now.getUTCDate().toString().padStart(2, "0");
	const hours = now.getUTCHours().toString().padStart(2, "0");
	const minutes = now.getUTCMinutes().toString().padStart(2, "0");
	const seconds = now.getUTCSeconds().toString().padStart(2, "0");

	const randomSuffix = Math.random().toString(36).substring(2, 8);

	return `${prefix}_${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${randomSuffix}`;
};

const saveBase64Image = async (
	app: App,
	imagePath: string,
	base64Image: string,
): Promise<void> => {
	// Remove 'data:image/png;base64,' if present
	const base64Data: string = base64Image.split(",")[1] || base64Image;

	// Convert base64 to array buffer
	const imageBuffer: ArrayBuffer = base64ToArrayBuffer(base64Data);

	// Save to file
	await writeImageToFile(app, imageBuffer, imagePath);
};

const writeImageToFile = async (
	app: App,
	imageBuffer: ArrayBuffer,
	imagePath: string,
): Promise<void> => {
	try {
		const fileAdapter = app.vault.adapter;

		// Write the array buffer to the vault
		await fileAdapter.writeBinary(imagePath, new Uint8Array(imageBuffer));
		console.log("Image saved successfully.");
	} catch (error) {
		console.error("Error saving the image:", error);
	}
};

const getImagesFolder = async (app: App) => {
	let imagesFolder = app.vault.getFolderByPath("generated-images");
	if (!imagesFolder) {
		imagesFolder = await app.vault.createFolder("generated-images");
	}

	return imagesFolder;
};

export const drawTool = prepareToolConfig(
	"openaiAPIKey",
	"draw",
	`Draws an image based on the given prompt. The returned image is visible to me, as a user message. If you would like to refer to the generated image, you need to do it like this, as img tags will not work:

![[generated-images/[...].png]]
`,
	z.object({
		prompt: z.string().describe("The prompt to draw an image"),
	}),
	async (app, apiKey, { prompt }, produceAdditionalNodes) => {
		const openAI = new OpenAI({
			apiKey,
			dangerouslyAllowBrowser: true,
		});

		const response = await openAI.images.generate({
			prompt,
			model: "dall-e-3",
			response_format: "b64_json",
		});

		const b64Json = response.data[0].b64_json!;

		const imageFolder = await getImagesFolder(app);

		const imageFileName = generateFileName("dall-e");
		const finalUrl = `${imageFolder.path}/${imageFileName}.png`;

		await saveBase64Image(app, finalUrl, b64Json);

		new Notice(`Generating image "${imageFileName}" done successfully.`);

		const outputURL = finalUrl;
		produceAdditionalNodes(
			`![[${outputURL}]][^1]\n\n[^1]:${prompt}`,
			{
				role: "user",
				name: "DALL-E",
				content: [
					{
						type: "image_url",
						image_url: {
							url: `data:image/png;base64,${b64Json}`,
						},
					},
				],
			},
			{
				width: 534,
				height: 672,
			},
		);

		return {
			success: true,
			result: `The image has been drawn to the canvas, and can be addressed as \`${outputURL}\`.`,
		};
	},
);
