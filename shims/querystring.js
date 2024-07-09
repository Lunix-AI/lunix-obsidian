// shim-querystring.js
const queryString = require('query-string').default;

console.log('querystring shim loaded', queryString);

module.exports = {
	parse: queryString.parse,
	stringify: queryString.stringify,
	// Add any additional functions you need to shim
	default: queryString
};
