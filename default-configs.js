'use strict';

var path = require('path');
var webpack = require('webpack');

/*
    注意這份是方便用戶編輯的版本，執行時還會搭配 CLI 參數才生成最終 webpack-client.config.js 與 webpack-server.config.js
*/


// browser client 用的
exports.client = {

    // 下面為雙機板用的網路參數
    protocol: 'http',
    host: 'localhost',
    port: 9090,

    // 下面為 config 基本參數
    entryFile: './js/boot-client', // 將來會放入 entry:[] 內
    output: {
        path: path.join(__dirname, 'build'),
        filename: 'bundle.js',
        publicPath: '/build/'
    },

    devServer: {
        contentBase: path.resolve(__dirname, "./assets"),
        watchDelay: 300
    },

    plugins: [],

    resolve: {
        alias: {},
        extensions: ['', '.js', '.jsx']
    },

    module: {
        loaders: [

            {
                test: /\.jsx?$/,
                loaders: ['$hot', 'babel?stage=0'],
                exclude: /node_modules/,
            },
            {
                test: /\.css?$/,
                // loaders: ['style-loader', 'css-loader?minimize'],
                loader: 'style-loader!css-loader?minimize'
            }

        ]
    },

}

exports.server = {

    target: 'node',

    externals: '$nodeModules',

    // server 版也需要 source maps, 並且指定要這種 type
    // 然後加掛一個 plugin
    devtool: 'sourcemap',

    // server bundle 通常要設為 true，這樣一改 server code 就會 re-build
    // 但我會在 server.js 裏動態設為 true，因此這裏固定用 false
    watch: false,

    entry: [
        './server'
    ],

    //
    output: {
        path: path.join(__dirname, './build'),
        filename: 'bundle-server.js',
    },

    // jx: 記得設定 babel 的 stage=0 才支援最新 es7 語法
    module: {
        loaders: [{
                test: /\.jsx?$/,
                loaders: ['babel?stage=0'],
                exclude: /node_modules/,
            },
        ]
    },

    //
    plugins: [
        // 為了生成 server js 的 source map
        new webpack.BannerPlugin('require("source-map-support").install();',
                                   { raw: true, entryOnly: false }),

        // server 上直接排除掉 css
        new webpack.IgnorePlugin(/\.(css|less)$/),

        // tell the server-side to ignore a top-level require for css
        // 這是 james 文章中最後提到的，但他自已也沒用，因此只是留察
        // new NormalModuleReplacementPlugin(/\.css$/, 'node-noop'),
    ],

    //
    resolve: {

        alias: {
            // 'redux': path.join(__dirname, '..', '..', 'src')
            // 'redux': 'redux'
        },
        // require() 時不用加 .suffix
        extensions: ['', '.js', '.jsx'],

        // jxtest: 不知為何要加
        // modulesDirectories: ["web_modules", "node_modules"]
    },

    progress: true,

}
