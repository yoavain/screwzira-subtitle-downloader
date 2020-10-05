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
        new webpack.DefinePlugin({
            KTUVIT_EMAIL: JSON.stringify(process.env.KTUVIT_EMAIL),
            KTUVIT_PASSWORD: JSON.stringify(process.env.KTUVIT_PASSWORD)
        }),
        new webpack.IgnorePlugin(/\.(css|less)$/),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: "node_modules/node-notifier/vendor/snoreToast/snoretoast-x64.exe",
                    to: "../dist/snoretoast-x64.exe",
                    toType: "file"
                },
                {
                    from: "resources/bin/ktuvit-downloader-launcher.exe",
                    to: "../dist/ktuvit-downloader-launcher.exe",
                    toType: "file"
                },
                {
                    from: "resources/notif-icons-ktuvit/",
                    to: "../dist/notif-icons/"
                }
            ]
        })
    ],
    devtool: "source-map"
};
