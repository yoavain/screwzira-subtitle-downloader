const webpack = require('webpack');
const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: './_compile/index.js',
    target: 'node',
    node: {
        __filename: true,
        __dirname: true
    },
    output: {
        path: path.join(__dirname, '_build'),
        filename: 'index.js'
    },
    plugins: [
        new CleanWebpackPlugin(),
        new webpack.IgnorePlugin(/\.(css|less)$/),
        new CopyWebpackPlugin([
            {
                from: 'node_modules/node-notifier/vendor/snoreToast/snoretoast-x64.exe',
                to: '../dist/snoretoast-x64.exe',
                toType: 'file'
            },
            {
                from: 'resources/bin/screwzira-downloader-launcher.exe',
                to: '../dist/screwzira-downloader-launcher.exe',
                toType: 'file'
            },
            {
                from: 'resources/notif-icons/',
                to: '../dist/notif-icons/'
            }
        ])
    ],
    devtool: 'sourcemap'
};
