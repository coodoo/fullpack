'use strict';

var fs = require('fs');
var path = require('path');
var assign = require('object-assign');
var ncp = require('ncp').ncp;
// var exec = require('shelljs').exec;
var execFile = require('child_process').execFile;
var cheerio = require('cheerio');


// webpack-dev-server
var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var HotModuleReplacementPlugin = require('webpack/lib/HotModuleReplacementPlugin');
var ProgressPlugin = require('webpack/lib/ProgressPlugin');

// var configs = require('./webpack-configs');
var configs;
var vars;
var template;

//========================================================================
//
// functions

// util: server bundle 時要排除所有 native module
function collectModules(){

    // server 用，排除 nodejs native modules
    var nodeModules = {};
    fs.readdirSync('node_modules')
      .filter(function(x) {
        return ['.bin'].indexOf(x) === -1;
      })
      .forEach(function(mod) {
        nodeModules[mod] = 'commonjs ' + mod;
      });

    return nodeModules;
}

// 第一步是拿到一包 config.client{}
// 依上方 defaultParams{} 內容補充必要的項目到這個 client{} 內
// 然後拿去套在 templateObj{} 身上
// 第二步是看裏面的 hot, inline 來決定要添加哪些物件到 vars{} 內

// name: configs{} 內宣告的一組設定
function makeClientConfig( name, params ){

    // 如果不是 dev mode，則 run 與 inline 必然不執行
    if(params.mode != 'dev' ) params.hot = params.inline = false;

    var config = name;

    // 將這兩個參數強迫加到 config{} 身上，它們是必需存在的 key
    config.devtool = params.devtool;
    config.hot = params.hot;

    var str;
    var entry = [];

    // dev 模式
    if( params.mode == 'dev' ){

        if( params.inline ){
            entry.push('webpack-dev-server/client/?'+ config.protocol + '://' + config.host + ':' + config.port);
        }

        if( params.hot ) {

            entry.push('webpack/hot/dev-server');

            // 處理 plugins
            config.plugins.push(new webpack.HotModuleReplacementPlugin());

            // 處理 loader
            var loader = config.module.loaders[0];
            if( loader.loaders[0] == '$hot') loader.loaders[0] = 'react-hot';
        }else{
            var loader = config.module.loaders[0];
            if( loader.loaders[0] == '$hot') loader.loaders.shift(); // 刪掉 $hot 假字串
        }

        // entry 最後一筆才放真正的進入點 js
        entry.push(config.entryFile);
        config.entry = entry;

        if( params.fullUrl ){
            str = config.protocol + '://' + config.host + ':' + config.port;
            config.output.publicPath = str + config.output.publicPath;
        }

    }else{

        config.entry = config.entryFile;

        var loader = config.module.loaders[0];
        if( loader.loaders[0] == '$hot') loader.loaders.shift(); // 刪掉 $hot 假字串

        // prod

        config.plugins.push(new webpack.optimize.OccurenceOrderPlugin());

        config.plugins.push(new webpack.NoErrorsPlugin());

        config.plugins.push(new webpack.optimize.UglifyJsPlugin({
            drop_console: true, comments: false, sourceMap: false, mangle: true, compress: {warnings: false} }));

    }

    // console.log( '\n合成後 config: \n', require('util').inspect( config, false, 4, true) );

    return config;
}

// 依前面整理好的 config 生成最終 client 要用的 webpack-config 檔案
function fillClientTemplate(vars){

    return {

        devtool: vars.devtool,

        entry: vars.entry,

        //
        output: vars.output,

        //
        plugins: vars.plugins,

        //
        resolve: vars.resolve,

        module: vars.module,

        // 注意 webpack.config.js 的內容不會自動傳入 webpack-dev-server
        // 因此這段 devServer{} 要獨立擁有一份設定值
        // 將來啟動 webpack-dev-server 給 client 用時，會將這包傳進去當做第二參數
        devServer: {
            contentBase: vars.devServer.contentBase,
            filename: vars.output.filename,
            publicPath: vars.output.publicPath,
            hot: vars.hot,


            // 下面是不重要的參數，可能也不會改它，因此就不設成變數了
            // webpack-dev-middleware options
            quiet: true, // 設為 true 即不會顯示太多 debug 訊息，讓 console 乾淨一點
            noInfo: true,
            lazy: false, // false 是啟動 watch mode，有變化即自動編譯
            stats: {
                colors: true,
                cached: false,
                cachedAssets: false
            },
            stats: { colors: true },
            watchOptions: {
                aggregateTimeout: vars.devServer.watchDelay || 300,
                poll: 1000
              },

        }
    };
}

// server 專用
// 啟動 express server
// 啟動 webpack build service
// 開始 watch change
// 每次變動後重新編譯並僅重啟 express server
function startServer(template) {

    clear();

    // var wpOpt = template;   // require('./webpack-server.config.js');

    // 啟動 server 版專用 webpack build 服務
    // 等 build 完立即載入 bundle-server.js 使其生效
    // 然後啟動 client 版專用的 webpack-dev-server 服務
    var compiler = webpack( template );

    // 備用：將來 watcher.close() 可停止監看
    var watcher = compiler.watch( {}, function(err, stats){

        // 每次偵知到 server 檔案變化並重新編譯後，會觸發這支 callback，接著要 reboot server
        if(err) return console.log( 'Bundle Error: ', err );

        console.log( '\n\t← server build completed' );

        // 只在 entry.js 啟動時跑一次
        // global.server 這變數是 server.js 內啟動 express 後存入的
        // 可籍此判斷當前是否有 server 運行中，沒有的話，就是第一次
        if( !global.server ){

            // 亮點：這裏載入新編譯好的 bundle-server.js 檔，讓它立即生效
            console.log( '\t← starting Express server - run only once' );
            try{

                require(path.resolve(process.cwd(), './build/bundle-server'));

            }catch(e){
                console.log( '\n\nserver 啟動出錯，開始 debug: ', e.stack );
                execFile( 'npm run debug', [], function( error, stdout, stderr ) {
                	// 有時 error 會有錯誤訊息，但實際上指令可以跑，只要看 stdout 即可
                  process.exit();
                });
                /*require('shelljs').exec('npm run debug', function(){
                    process.exit();
                })*/
            }
            console.log( '\t← express server started');

            return;
        }

        clear();

        // 先強制關掉所有連線 socket，這樣 server 才能 reboot，不然要等 3s 才會 timeout
        global.sockets.forEach(function(socket){
            socket.destroy();
        })
        global.sockets = [];
        delete global.sockets;

        // 再關 server
        global.server.removeAllListeners();
        global.server.close( function(){

            console.log( '\treboot::shut down server' );

            delete global.server;

            // unload 舊的 module (即之前 webpack 編譯好的 bundle-server.js)
            console.log( '\treboot::unload old module' );
            var m = path.join( process.cwd(), './build/bundle-server.js');
            // console.log( '\treboot::module path: ', m );
            delete require.cache[m];

            // 重新載入 module
            console.log( '\treboot::load new module' );
            require(m);

            console.log( '\treboot::reload completed' );

        });

    })
}

// client 版專用 webpack-dev-server
// 會持續 watch 與 rebuild 檔案
// 它被設定為透過 http://localhost:9090/build/bundle.js 來提供服務
function startClient(template) {

    // console.log( '\n啟動 webpack-dev-server for client:\n', template );

    // var wpOpt = template; //require('./webpack-client.config.js');

    // 啟動 webpack-dev-server，並傳入 compiler
    var devServer = new WebpackDevServer( webpack( template ), template.devServer);

    devServer.listen(9090, 'localhost', function(){
        console.log( '\n\t← webpack-dev-server for browser 啟動於 9090' );
    })
}

// production 專用
// 輸出 client 版的 bundle.js 在 /build 下面
function outputBundles(params) {

    // console.log( '\n輸出 client 與 server 的 production bundle js' );

    // client bundle
    var vars = makeClientConfig( configs.client, params );
    var template = fillClientTemplate(vars);
    // console.log( '\nproduction bundle:\n', template );
    webpack( template, function(err, res){ console.log( 'client 有錯嗎: ', err /*, '\n\nres:\n', res*/ )});

    // server bundle
    if(configs.server.externals == '$nodeModules') configs.server.externals = collectModules();
    if(configs.server.devtool) delete configs.server.devtool;
    webpack(configs.server, function(err){console.log( 'server 有錯嗎: ', err );});
}

// 寫出 client/server 的 webpack-client.config.js, webpack-server.config.js 檔
function generateConfigFiles(params) {
    var vars = makeClientConfig( configs.client, params );
    var template = fillClientTemplate(vars);
    template.plugins = [];
    // console.log( '\n看:  \n', require('util').inspect( template, false, 6, true) );

    var append = '//=== Generated by program, plugins info missing ===\n\n';
    // var require = 'var webpack = require('webpack');\n';

    var prepend = 'module.exports = ';

    // 寫出 client config
    fs.writeFile("webpack-client-debug.config.js",
        append + prepend + require('util').inspect( template, false, 6, false),
        function(err) {
        if(err) {
            return console.log('webpack-client-debug.config.js 寫出錯誤: ', err);
        }
    });

    // 寫出 server config
    if(configs.server.externals == '$nodeModules') configs.server.externals = collectModules();
    if(configs.server.devtool) delete configs.server.devtool;
    fs.writeFile("webpack-server-debug.config.js",
        append + prepend + require('util').inspect( configs.server, false, 6, false),
        function(err) {
            if(err) {
                return console.log('webpack-server-debug.config. 寫出錯誤: ', err);
            }
    });

}

// 將 assets/ 目錄複製到 build/assets/ 下面
function copy() {

    ncp('assets/', 'build/assets/', function(err){
        if(err) return console.log( 'copy failed: ', err );

        replace();
    });
}

// 修改 index.html 內的 src 值
// 從 <script id='bundle' src="http://localhost:9090/build/bundle.js"></script>
// 變成 <script id='bundle' src="../bundle.js"></script>
// 注意目前一律是寫出 '../bundle.js' 這路徑
function replace( bundle ){
    var str = bundle || '../bundle.js';
    // 讀出 /build/asset/index.html 內容
    // var file = "<script id='bundle' src='http://localhost:9090/build/bundle.js'></script>";
    var file = fs.readFileSync('assets/index.html')
    // console.log( '\n讀出: ', file.toString() );

    // 刪掉　comment
    file = file.toString().replace(/<!--[\s\S]*?-->/g, '');

    // 置換正確 bundle 檔案
    var $ = cheerio.load( file, {decodeEntities: false} );
    $('#bundle').attr('src', str);
    // console.log( 'html 置換結果: ', $.html() );

    // 然後寫回 /build/assets/index.html 內
    fs.writeFileSync('build/assets/index.html', $.html());
}

function clear(){
    process.stdout.write('\u001B[2J\u001B[0;0f');
    // process.stdout.write('\x1B[2J');
}

exports.init = function(conf){
    configs = conf;
}

exports.collectModules = collectModules;
exports.makeClientConfig = makeClientConfig;
exports.fillClientTemplate = fillClientTemplate;
exports.startServer = startServer;
exports.startClient = startClient;
exports.outputBundles = outputBundles;
exports.generateConfigFiles = generateConfigFiles;
exports.copy = copy;
