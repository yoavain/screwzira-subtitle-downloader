const webpack = require("webpack");
const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    mode: "production",
    entry: "./src/index.ts",
    target: "node",
    node: {
        __filename: true,
        __dirname: true
    },
    output: {
        path: path.join(__dirname, "_build"),
        filename: "index.js"
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
        alias: {
            "~src": path.resolve(__dirname, 'src'),
            "~test": path.resolve(__dirname, 'test'),
            "~resources": path.resolve(__dirname, 'resources')
        }
    },
    plugins: [
        new CleanWebpackPlugin(),
        new webpack.IgnorePlugin(/\.(css|less)$/),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: "node_modules/node-notifier/vendor/snoreToast/snoretoast-x64.exe",
                    to: "../dist/snoretoast-x64.exe",
                    toType: "file"
                },
                {
                    from: "resources/bin/screwzira-downloader-launcher.exe",
                    to: "../dist/screwzira-downloader-launcher.exe",
                    toType: "file"
                },
                {
                    from: "resources/notif-icons/",
                    to: "../dist/notif-icons/"
                }
            ]
        })
    ],
    devtool: "source-map"
};
