import type { App } from "obsidian";
import { getJson } from "serpapi";
import { z } from "zod";
import { prepareToolConfig } from "~/toolConfig";

type Search = {
	search_metadata: SearchMetadata;
	search_parameters: SearchParameters;
	search_information: SearchInformation;
	inline_images: InlineImage[];
	answer_box: AnswerBox;
	organic_results: OrganicResult[];
	pagination: Pagination;
	serpapi_pagination: Pagination;
};

type AnswerBox = {
	type: string;
	thumbnail: string;
};

type InlineImage = {
	link: string;
	source: string;
	thumbnail: string;
	original: string;
	title: string;
	source_name: string;
};

type OrganicResult = {
	position: number;
	title: string;
	link: string;
	redirect_link?: string;
	displayed_link: string;
	thumbnail?: string;
	favicon: string;
	snippet: string;
	snippet_highlighted_words?: string[];
	source: string;
	duration?: string;
	missing?: string[];
	must_include?: MustInclude;
	video_link?: string;
	date?: string;
};

type MustInclude = {
	word: string;
	link: string;
};

type Pagination = {
	current: number;
	next: string;
	other_pages: {
		[key: string]: string;
	};
	next_link?: string;
};

type SearchInformation = {
	query_displayed: string;
	total_results: number;
	time_taken_displayed: number;
	organic_results_state: string;
};

type SearchMetadata = {
	id: string;
	status: string;
	json_endpoint: string;
	created_at: string;
	processed_at: string;
	google_url: string;
	raw_html_file: string;
	total_time_taken: number;
};

type SearchParameters = {
	engine: string;
	q: string;
	google_domain: string;
	hl: string;
	gl: string;
	device: string;
};

let lastSearchTime = 0;
export const googleSearchTool = prepareToolConfig(
	"serpAPIKey",
	"googleSearch",
	"Search the web using Google. This is more expensive so should be used if other search engines do not return the desired results. After getting the results, you HAVE TO to use the browse tool on all of the relevant links in the next message to get the direct information.",
	z.object({
		query: z.string().describe("The search query"),
	}),
	async (
		_app: App,
		apiKey: string,
		params: {
			query: string;
		},
	) => {
		const { query } = params;

		if (Date.now() - lastSearchTime < 1500) {
			await new Promise((resolve) => setTimeout(resolve, 1500));
		}

		console.log(`${new Date().toISOString()} - Searching for: ${query}`);

		try {
			lastSearchTime = Date.now();

			const response = (await getJson({
				api_key: apiKey,
				engine: "google",
				q: query,
				google_domain: "google.com",
				gl: "us",
				hl: "en",
			})) as Search;

			console.log(response);

			return {
				totalResults: response.search_information.total_results,
				organicResultsState: response.search_information.organic_results_state,
				organicResults: response.organic_results.map((result) => ({
					title: result.title,
					link: result.link,
					snippet: result.snippet,
					displayedLink: result.displayed_link,
					source: result.source,
				})),
			};
		} catch (e) {
			console.error(e);
			return {
				title: "Error",
				url: "",
				description: "An error occurred while performing the search",
			};
		}
	},
);
