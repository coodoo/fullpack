import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import * as ShopActions from '../actions/ShopActions';

if ( 'undefined' !== typeof window ) {
	require( '../../assets/css/main.css' );
}
export default class TodoApp extends Component {

	static contextTypes = {
		store: React.PropTypes.object.isRequired,
	};

  render() {
	// console.log( 'TodoApp > props: ', this.props );

	const { isTransitioning } = this.props;

	let nodes;

	if ( isTransitioning ) {
		nodes = (
			<div>
				{<div>LOADING...</div>}
			</div>
		)

	}else {

		nodes = (
			<div>
				<div>placeholder</div>
				{this.props.main}
				{this.props.cart}
			</div>
		)
	}

	return nodes;
  }

}
