const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	entry: './compiled/index.js',
	target: 'node',
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
		}
		])
	],
	devtool: 'sourcemap'
};