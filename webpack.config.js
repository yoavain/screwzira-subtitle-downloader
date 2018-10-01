const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const CopyWebpackPlugin = require('copy-webpack-plugin');

var nodeModules = {};
fs.readdirSync('node_modules')
.filter(function(x) {
	return ['.bin'].indexOf(x) === -1;
})
.forEach(function(mod) {
	nodeModules[mod] = 'commonjs ' + mod;
});
  
module.exports = {
	entry: './compiled/index.js',
	target: 'node',
	output: {
		path: path.join(__dirname, 'built'),
		filename: 'index.js'
	},
	externals: nodeModules,
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
}