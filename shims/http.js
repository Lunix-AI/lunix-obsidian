// shim-https.js
const http = require("http-browserify");

console.log("http shim loaded", http);

module.exports = http;
