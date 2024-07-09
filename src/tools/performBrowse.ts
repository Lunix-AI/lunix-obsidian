import FirecrawlApp from "@mendable/firecrawl-js";
import { type App, request } from "obsidian";
import { z } from "zod";
import { prepareToolConfig } from "~/toolConfig";

// const result = await runJavascript({"input":{"url":"https://paulgraham.com/greatwork.html"},"jsFunction":"async function(input, storage) { const response = await window.request({ url: input.url }); const htmlString = response; const parser = new DOMParser(); const doc = parser.parseFromString(htmlString, 'text/html'); const readabilityScript = document.createElement('script'); readabilityScript.src = 'https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.min.js'; document.head.appendChild(readabilityScript); await new Promise((resolve) => { readabilityScript.onload = resolve; }); if (typeof Readability !== 'undefined') { const reader = new Readability(doc); const article = reader.parse(); return article; } else { throw new Error('Failed to load Readability library'); } }"});
import { Readability } from "@mozilla/readability";

const browseViaReadability = async (url: string) => {
	const htmlString = await request({
		url,
	});

	const parser = new DOMParser();

	const doc = parser.parseFromString(htmlString, "text/html");

	const reader = new Readability(doc);
	const article = reader.parse();

	if (!article) {
		return {
			success: false,
			error: "Failed to parse the article",
		};
	}

	return {
		success: true,
		content: article.textContent,
		metadata: {
			title: article.title,
			description: article.excerpt,
		},
	};
};

export const browseTool = prepareToolConfig(
	"firecrawlAPIKey",
	"browse",
	"Use this tool to get the content of a webpage. Present the results in a engaging and interesting format, especially making sure to include the media from the results in your response. DO NOT use this tool for youtube video links, embed them in your response instead so I can watch it myself",
	z.object({
		url: z.string().describe("The URL to browse"),
	}),
	async (_app: App, apiKey: string, { url }) => {
		try {
			// do a request from https://r.jina.ai/{url}
			const response = await request({
				url: `https://r.jina.ai/${url}`,
			});

			return {
				success: true,
				content: response,
				metadata: {},
			};
		} catch (e) {
			console.log("Failed to use Jina", e);
		}

		try {
			const firecrawlApp = new FirecrawlApp({ apiKey });

			const scrapeResult = await firecrawlApp.scrapeUrl(url);

			console.log(scrapeResult);

			if (scrapeResult.success) {
				return {
					success: true,
					content: scrapeResult.data?.markdown ?? scrapeResult.data?.content,
					metadata: scrapeResult.data.metadata
						? {
								title:
									scrapeResult.data.metadata.ogTitle ??
									scrapeResult.data.metadata.title,
								description:
									scrapeResult.data.metadata.ogDescription ??
									scrapeResult.data.metadata.description,
							}
						: {},
				};
			}
		} catch (e) {
			console.log("Failed to use Firecrawl", e);
		}

		try {
			const result = await browseViaReadability(url);

			if (result.success) {
				return result;
			}
		} catch (e) {
			console.log("Failed to use Readability", e);
		}

		return {
			success: false,
			error: "Failed to browse the URL",
		};
	},
);
