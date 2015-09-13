import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { applyMiddleware, createStore, combineReducers, compose } from 'redux';
import Immutable from 'immutable';
import { Provider } from 'react-redux';
import * as reducers from './reducers';
import promiseMiddleware from './utils/PromiseMiddleware';
import TodoApp from './components/TodoApp';
import {ProductState, ProductRecord, CartState, convertMapToImmutable} from './constants/Types';
import {Router, Route} from 'react-router';
import {history} from 'react-router/lib/BrowserHistory';

// 資料是否已由 server 生成過，並在 client 還原了，如此可避免 client code 再撈一次資料
window.$RESTORED = false;

// 客戶端嚐試還原 state，如果有找到這個 elem 並且有內容，就代表為 isomorphic 版本
let state = null;
if ( window.$REDUX_STATE ) {

	// 解開 server 預先傳來的資料包，稍後會放入 store 成為 initState
	state = window.$REDUX_STATE;

	// begin marshalling data into Immutable types
	state.products = new ProductState( {
		$fetched: document.location.pathname == '/',
		productsById: convertMapToImmutable( state.products.productsById, ProductRecord ),
		total: state.products.total,
		currentProductId: state.products.currentProductId,
	} );

	state.carts = new CartState( {
		cartsById: Immutable.List.of( ...state.carts.cartsById ),
	} );

	// 用完就刪掉
	delete window.$REDUX_STATE;

	window.$RESTORED = true;

	// console.log( 'state restored: ', state.products.toJS(), state.carts.toJS() );
}

// 就是 composeStores(), 將所有 stores 合併起來成為一個 composition(state, action) 指令
// 將來操作它就等於操作所有 reducers
const composedReducers = combineReducers( reducers );

// 掛上 reudx-devtools
let cs = createStore;;

const finalCreateStore = applyMiddleware( promiseMiddleware )( cs );

// 重要：需視是否為 server rendering 而決定是否傳入 state 物件
let store = state ? finalCreateStore( composedReducers, state ) : finalCreateStore( composedReducers );

// 啟動 router，偷傳 store 進去方便它內部在每條 routing rule 啟動前先撈資料
const routes = require( './routes/routing' )( store );

ReactDOM.render(

	<Provider store={store}>
		<Router history={history} children={routes} />
	</Provider>,

	document.querySelector( '.container' )
);
