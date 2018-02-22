const path = require("path");

module.exports = {
	entry: "./src/index.js",
	output: {
		filename: "netscan.js",
		path: path.resolve(__dirname, "dist"),
		library: "NetScan",
		libraryTarget: "var"
	},
	resolve: {
		modules: [
			path.resolve(__dirname, "src"), 
			"node_modules"
		]
	}
};