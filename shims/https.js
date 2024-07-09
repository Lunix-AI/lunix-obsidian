// shim-https.js
// noinspection JSUnusedGlobalSymbols

const rawHttps = require("https-browserify");
const { request } = require("obsidian");

const https = {
	...rawHttps,
	get: (url, _options, _callback) => {
		let errorListener = () => {};
		let options = _options;
		let callback = _callback;

		// if options is a function, callback is options
		if (typeof options === "function") {
			callback = options;
			options = {};
		}

		request({
			url,
			method: "GET",
			...options,
		}).then(
			(response) => {
				console.log("response", response);
				callback({
					on: (event, callback) => {
						if (event === "data") {
							callback(response);
						} else if (event === "end") {
							callback();
						}
					},
					setEncoding: () => {},
					statusCode: 200,
				});
			},
			(error) => {
				console.error("error", error);
				errorListener(error);
			},
		);

		return {
			on: (event, errorCallback) => {
				if (event === "error") {
					errorListener = errorCallback;
				}
			},
		};
	},
};

console.log("https shim loaded", https);

module.exports = {
	default: https,
	...https,
};
