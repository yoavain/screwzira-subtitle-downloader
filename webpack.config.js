const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	entry: './compiled/index.js',
	target: 'node',
	node: {
		__filename: true,
		__dirname: true
	},
	output: {
		path: path.join(__dirname, 'built'),
		filename: 'index.js'
	},
	plugins: [
		new webpack.IgnorePlugin(/\.(css|less)$/),
		new CopyWebpackPlugin([
		{
			from: 'node_modules/node-notifier/vendor/snoreToast/SnoreToast.exe',
			to: '../dist/SnoreToast.exe',
			toType: 'file'
		},
		{
			from: 'resources/bin/screwzira-downloader-launcher.exe',
			to: '../dist/screwzira-downloader-launcher.exe',
			toType: 'file'
		}
		])
	],
	devtool: 'sourcemap'
};