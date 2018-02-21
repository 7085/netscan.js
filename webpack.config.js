const path = require("path");

module.exports = {
	entry: "./src/netscan.js",
	output: {
		filename: "netscan.js",
		path: path.resolve(__dirname, "dist")
	}
};