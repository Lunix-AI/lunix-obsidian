import { App, request } from "obsidian";
import { z } from "zod";
import { prepareToolConfig } from "~/toolConfig";
import { withQueue } from "~/utils/queueManager";
import { rateLimit } from "~/utils/rateLimit";

type Search = {
	query: Query;
	mixed: Mixed;
	type: string;
	web: Web;
	videos: Videos;
};

type Mixed = {
	type: string;
	main: Main[];
	top: any[];
	side: any[];
};

type Main = {
	type: MainType;
	index: number;
	all: boolean;
};

enum MainType {
	Web = "web",
}

type Query = {
	original: string;
	show_strict_warning: boolean;
	is_navigational: boolean;
	is_news_breaking: boolean;
	spellcheck_off: boolean;
	country: string;
	bad_results: boolean;
	should_fallback: boolean;
	postal_code: string;
	city: string;
	header_country: string;
	more_results_available: boolean;
	state: string;
};

/*duration	string	A time string representing the duration of the video. The format can be HH:MM:SS or MM:SS.
views	string	The number of views of the video.
creator	string	The creator of the video.
publisher	string	The publisher of the video.
thumbnail	Thumbnail	A thumbnail associated with the video.
*/
type VideoData = {
	duration: string;
	views: string;
	creator: string;
	publisher: string;
	thumbnail: Thumbnail;
};

/*type	"video_result"	The type identifying the video result. The value is always video_result.
video	VideoData	Meta data for the video.
meta_url	MetaUrl	Aggregated information on the URL
thumbnail	Thumbnail	The thumbnail of the video.
age	string	A string representing the age of the video.*/
type VideoResult = {
	type: "video_result";
	video: VideoData;
	meta_url: MetaURL;
	thumbnail: Thumbnail;
	age: string;
};

/*
FIELD	TYPE	DESCRIPTION
type	videos	The type representing the videos. The value is always videos.
results	list [ VideoResult ]	A list of video results.
mutated_by_goggles	bool	Whether the video results are changed by a Goggle. False by default.*/
type Videos = {
	type: "videos";
	results: VideoResult[];
	mutated_by_goggles: boolean;
};

type Web = {
	type: string;
	results: Result[];
	family_friendly: boolean;
};

type Result = {
	title: string;
	url: string;
	is_source_local: boolean;
	is_source_both: boolean;
	description: string;
	page_age?: Date;
	profile: Profile;
	language: Language;
	family_friendly: boolean;
	type: ResultType;
	subtype: Subtype;
	meta_url: MetaURL;
	thumbnail?: Thumbnail;
	age?: string;
	extra_snippets: string[];
	deep_results?: DeepResults;
};

type DeepResults = {
	buttons: Button[];
};

type Button = {
	type: ButtonType;
	title: string;
	url: string;
};

enum ButtonType {
	ButtonResult = "button_result",
}

enum Language {
	En = "en",
}

type MetaURL = {
	scheme: Scheme;
	netloc: string;
	hostname: string;
	favicon: string;
	path: string;
};

enum Scheme {
	HTTPS = "https",
}

type Profile = {
	name: string;
	url: string;
	long_name: string;
	img: string;
};

enum Subtype {
	Article = "article",
	Generic = "generic",
	Video = "video",
}

type Thumbnail = {
	src: string;
	original: string;
	logo: boolean;
};

enum ResultType {
	SearchResult = "search_result",
}

type BraveSearchResponse =
	| {
			success: true;
			results: {
				title: string;
				url: string;
				description: string;
			}[];
	  }
	| {
			success: false;
			error: string;
	  };

const params = z.object({
	query: z.string().describe("The search query"),
	count: z.number().optional().default(5),
	offset: z.number().optional().default(0),
});

export const braveSearchTool = prepareToolConfig(
	"braveAPIKey",
	"braveSearch",
	`Search the web for the given query. This uses the brave search API. Prefer this over other search tools as it is more privacy-focused.
	
If the results are not satisfactory, you can then use the google search tool.

**IMPORTANT: After each search, you MUST use the browse tool on at least the top 3 relevant results before responding to me. This step is mandatory and cannot be skipped, except for youtube videos.**

If video links are relevant to my request, you can skip the browse tool and directly respond with the video information.
	
If the search results show no relevant information at all, you MUST use the search tool again with a different query. Do this until 3 tries. After that, tell me there were no relevant results.

You MUST answer my question directly, sometimes the search results can be irrelevant so you need to pick well.

DO NOT repeat searches if I ask for information that's already in the conversation, refer to the previous messages instead.

If I ask about information that could have changed recently, make sure to use a search.

<examples>  
<example>
<user_query>
What's the news in Australia today?
</user_query>
<assistant_response>
Let me search that for you.
[search(Australia news ...)]
</assistant_response>
<tool_response>
[link1, link2, link3]
</tool_response>
<assistant_response>
Let's see what the news is today from the top 3 results.
[browse(link1),browse(link2),browse(link3)]
</assistant_response>
<tool_response>
[content1, content2, content3]
</tool_response>
<assistant_response>
The news in Australia today is... [^source]
</assistant_response>
</example>
</examples>
`,
	params,
	withQueue(
		rateLimit(async (_app, apiKey, params): Promise<BraveSearchResponse> => {
			const { query } = params;

			console.log(`${new Date().toISOString()} - Searching for: ${query}`);

			try {
				const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${params.count}&offset=${params.offset}`;

				console.log("searchUrl", searchUrl);

				const response = await request({
					url: searchUrl,
					headers: {
						Accept: "application/json",
						"X-Subscription-Token": apiKey,
					},
				});

				const data = JSON.parse(response) as Search;

				// console.log("Brave search response:", {
				// 	params,
				// 	data,
				// });

				if (!data.web.results) {
					console.log("no results?", data);
					return {
						success: false,
						error: "No results found",
					};
				}

				return {
					success: true,
					results: data.web.results.map((result) => {
						return {
							title: result.title,
							url: result.url,
							description: result.description,
						};
					}),
				};
			} catch (e) {
				console.error(e);
				return {
					success: false,
					error: `An error occurred while performing the search: ${e}`,
				};
			}
		}, 1500),
	),
);
