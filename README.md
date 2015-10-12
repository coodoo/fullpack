
Fullpack
========

Provide a handy `fullpack` command to fire up all services needed by server and client.


Design Goal
-----------

For server:
Start `webpack` to watch and compile server files whenever they change, also reload the newly compiled file to make it effective

For client:
Start `webpack-dev-server` to watch, compile and server files via `hot-reload` module for browser


Install
-------

$ npm install -g fullpack

Init
----
To create a default webpack-configs.js

$ fullpack init

Usage
-----

使用說明:

- 用戶只要改 ./webpack-configs.js 內 client 與 server 兩組參數
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
