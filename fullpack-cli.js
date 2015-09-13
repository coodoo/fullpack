#!/usr/bin/env node
'use strict';

/*
使用說明:

- 用戶只要改 /webpack-configs.js 內 client 與 server 兩組參數
    - 例如 host, port 之類的資訊

- CLI 執行時可傳參數微調功能

    -m: mode, dev|prod, default: dev
    -h: hot 模式，default: true
    -i: inline, default: true
    -f: fullUrl 於雙主機時可指定 client webpack-dev-server url, default: true
    -s: sourceMap 模式，對應到 devtool 參數，default: eval
    -d: debug，會寫出 client/server 兩份 webpack.config.js 檔案, default: false

- development

    - 雙主機模式時，設定 fullUrl 為 true

    $ node dev-cli -m dev -f true

- production

    - 會跑完整 production build 流程

    $ node dev-cli -m prod

- debug

    - 會寫出 webpack-client.config.js 與 webpack-server.config.js

    $ node dev-cli -d false

*/

var fs = require('fs');
var path = require('path');
var assign = require('object-assign');
var rimraf = require('rimraf');
var runner = require('./fullpack-core');
var ncp = require('ncp').ncp;

// webpack-dev-server
var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var HotModuleReplacementPlugin = require('webpack/lib/HotModuleReplacementPlugin');
var ProgressPlugin = require('webpack/lib/ProgressPlugin');

var vars;
var template;

// #如果是執行 fullpack init
// =======================
//
// 複製一份　default-configs.js　到專案目錄下
var temp = process.argv.slice(2);
if(temp.length == 1 && temp[0] == 'init'){
    ncp( path.resolve(__dirname, 'default-configs.js'),
         path.resolve(process.cwd(), 'webpack-configs.js'),
         function(err){
            if(err)
                return console.log( '複製出錯: ', err );
        })
    return;
}

// #繼續跑剩下的正常流程
// =================

var parse = require('minimist');
var argv = parse( process.argv.slice(2),
                  {
                    boolean:['h', 'i', 'f', 'd'],
                    default:{h:true, i:true, f:true, d:false}
                  });

// 將 CLI arguments 轉成 js obj
// console.log( '拿到:2: ', argv );

var configs;

// 如果沒透過 -c 傳入 config 路徑，就讀當前目錄下是否有 webpack-configs.js 檔案
if( argv.hasOwnProperty('c') == false ){
    configs = path.resolve(process.cwd(), './webpack-configs.js');
}else{
    // 傳入 config 檔案 -c webpack-configs.js
	configs = argv['c']
}

try{
	configs = require(path.resolve(__dirname, configs));
	// console.log( '讀完檔案: ', configs );
}catch(e){
	return console.error( 'Failed to open config file: ', configs );
}

runner.init(configs);

var customParams = {};

Object.keys(argv).map(function(key){
    switch(key){
        case 'm':
            customParams['mode'] = argv[key];
            break;

        case 'h':
            customParams['hot'] = argv[key];
            break;

        case 'i':
            customParams['inline'] = argv[key];
            break;

        case 'f':
            customParams['fullUrl'] = argv[key];
            break;

        case 's':
            customParams['devtool'] = argv[key];
            break;

        case 'd':
            customParams['debug'] = argv[key];
            break;
    }
})

// console.log( '\n>customParams:', customParams );

// 列在這的是 default 值，但可透過 CLI|API 在 runtime 傳不同參數進來改掉
var defaultParams = {
    mode: 'dev', // dev || prod 等於是 -d -p 模式，會自動塞入不同的 plugins
    hot: true,
    inline: true,
    fullUrl: true, // publicPath 是否要加上 http://localhost:9090/ 這字段
    devtool: 'eval', // '#source-map'
    debug: false
}

// 這是 CLI 傳入的參數總成，接著下面就會依這包參數來生成 webpack config 了
var params = assign({}, defaultParams, customParams );
// console.log( '\n>最終 params:\n', params );


//=== runner command =====================================================

// #debug 模式
// 只寫出 server 與 client 兩份 webpack-config 檔案供 debug 用
if( params.debug ){
    console.log( '僅輸出 debug 用 webpack config 檔，不啟動 server' );
    runner.generateConfigFiles( params );
    return;
}

if( params.mode == 'prod' ){

    console.log( '\n僅輸出 production bundle files，不啟動 server!' );

    rimraf.sync('build');	// 刪掉 build 目錄
    fs.mkdirSync('build'); // 重建 build 目錄

    runner.outputBundles( params );	// 只輸出兩份編譯好的 bundle 檔案，不會啟動 server

    // 將 assets/ 複製到 build/assets/ 下面，並改寫 index.html 的 <script> 路徑
    runner.copy();


}else{

    // #server 先啟動兩支服務
    // ===================
    // 1. webpack 執行 watch, build 服務
    // 2. express server
    if(configs.server.externals == '$nodeModules'){
        configs.server.externals = runner.collectModules();
    }
    // console.log( '\nserver config:  \n', require('util').inspect( configs.server, false, 4, true) );
    runner.startServer(configs.server);

    // #client 服務啟動
    // ==============
    // 1. webpack-dev-server for client
    vars = runner.makeClientConfig( configs.client, params );
    template = runner.fillClientTemplate(vars);
    // console.log( '\n最終 template: \n', require('util').inspect( template, false, 4, true) );
    runner.startClient(template);
}
