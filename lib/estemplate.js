/*
 * estemplate
 * https://github.com/Backlighting-Neo/estemplate
 *
 * Copyright (c) 2014 Ingvar Stepanyan
 * Licensed under the MIT license.
 */

'use strict';

var parse = require('esprima').parse;
var estraverse = require('estraverse');

var reCode    = /([^\s,;]?)\s*?%\s*?(=?)\s*([\s\S]+?)\s*%\s*?([^\s,;]?)/g;
var blockCode = /([^\s,;]?)\s*?%\s*?(\$)\s*([\s\S]+?)\s*%\s*?([^\s,;]?)/g;

var reInternalVar = /^__ASTER_DATA_\d+$/;
var reInternalMarker = /\"(__ASTER_DATA_\d+)\"/g;

function tmpl(str, options, data) {
	if (!data) {
		data = options;
		options = undefined;
	}
	return tmpl.compile(str, options)(data);
}

function isInternalVar(node) {
	return node.type === 'Identifier' && reInternalVar.test(node.name);
}

function isInternalStmt(node) {
	return node.type === 'ExpressionStatement' && typeof node.expression === 'string';
}

var brackets = {
	'<': '>',
	'[': ']',
	'(': ')',
	'{': '}',
	"'": "'",
	'"': '"'
};

var spread = {
	'ArrayExpression': 'elements',
	'CallExpression': 'arguments',
	'BlockStatement': 'body',
	'FunctionExpression': 'params',
	'FunctionDeclaration': 'params',
	'Program': 'body'
};

tmpl.fixAST = function (ast) {
	estraverse.traverse(ast, {
		leave: function (node, parent) {
			if (node.type !== '...') {
				return;
			}
			var itemsKey = spread[parent.type];
			if (!itemsKey) {
				throw new TypeError('Unknown substitution in ' + parent.type);
			}
			parent[itemsKey] = parent[itemsKey].reduce(function (items, item) {
				if (item.type === '...') {
					return items.concat(item.argument);
				}
				items.push(item);
				return items;
			}, []);
		},
		keys: {
			'...': ['argument']
		}
	});
	return ast;
};

// 预编译时要加入到头部的代码
var preCompileCode = [];
// 替换的ASTER_DATA编号
var index = 0;

// 插值预处理
function _interpolationPreHandler(str) {
	return str.replace(reCode, function (match, open, isEval, codePart, close) {
		if (open) {
			var expectedClose = brackets[open];
			if (!expectedClose || close && expectedClose !== close) {
				return match;
			}
		}
		if (isEval) {
			var varName = '__ASTER_DATA_' + (index++);
			var isSpread = open !== '<' && open !== "'" && open !== '"';
			if (isSpread) {
				codePart = '{type: "...", argument: ' + codePart + '}';
			} else if (open === "'" || open === '"') {
				codePart = '{type: "Literal", value: ' + codePart + '}';
			}
			preCompileCode.push('\t\tvar ' + varName + ' = ' + codePart);
			return isSpread ? (open + varName + close) : varName;
		} else {
			if (open !== '<') {
				return match;
			}
			preCompileCode.push(codePart);
			return '';
		}
	});
}

// 块级预处理
function _blockPreHandler(str) {
	return str.replace()
}

tmpl.compile = function (str, options) {
	str = _interpolationPreHandler(str);

	var ast = parse(str, options);

	ast = estraverse.replace(ast, {
		leave: function (node) {
			if (isInternalVar(node)) {
				return node.name;
			}

			if (isInternalStmt(node)) {
				return node.expression;
			}
		}
	});

	if (!(options && options.fast)) {
		code.unshift('\twith (it) {');
		code.push('\t}');
	}

	code.unshift('return function template(it) {');

	code.push(
		'\treturn estemplate.fixAST(' + JSON.stringify(ast).replace(reInternalMarker, '$1') + ')',
		'}'
	);

	return new Function('estemplate', code.join('\n'))(tmpl);
};

module.exports = tmpl;
