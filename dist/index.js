"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parse = exports.stringify = exports.isJSON = exports.reviver = exports.replacer = void 0;

var _global = require("global");

var _isRegex = _interopRequireDefault(require("is-regex"));

var _isFunction = _interopRequireDefault(require("is-function"));

var _isSymbol = _interopRequireDefault(require("is-symbol"));

var _isobject = _interopRequireDefault(require("isobject"));

var _get = _interopRequireDefault(require("lodash/get"));

var _memoizerific = _interopRequireDefault(require("memoizerific"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var removeCodeComments = function removeCodeComments(code) {
  var inQuoteChar = null;
  var inBlockComment = false;
  var inLineComment = false;
  var inRegexLiteral = false;
  var newCode = '';

  if (code.indexOf('//') >= 0 || code.indexOf('/*') >= 0) {
    for (var i = 0; i < code.length; i += 1) {
      if (!inQuoteChar && !inBlockComment && !inLineComment && !inRegexLiteral) {
        if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
          inQuoteChar = code[i];
        } else if (code[i] === '/' && code[i + 1] === '*') {
          inBlockComment = true;
        } else if (code[i] === '/' && code[i + 1] === '/') {
          inLineComment = true;
        } else if (code[i] === '/' && code[i + 1] !== '/') {
          inRegexLiteral = true;
        }
      } else {
        if (inQuoteChar && (code[i] === inQuoteChar && code[i - 1] !== '\\' || code[i] === '\n' && inQuoteChar !== '`')) {
          inQuoteChar = null;
        }

        if (inRegexLiteral && (code[i] === '/' && code[i - 1] !== '\\' || code[i] === '\n')) {
          inRegexLiteral = false;
        }

        if (inBlockComment && code[i - 1] === '/' && code[i - 2] === '*') {
          inBlockComment = false;
        }

        if (inLineComment && code[i] === '\n') {
          inLineComment = false;
        }
      }

      if (!inBlockComment && !inLineComment) {
        newCode += code[i];
      }
    }
  } else {
    newCode = code;
  }

  return newCode;
};

var cleanCode = (0, _memoizerific.default)(10000)(function (code) {
  return removeCodeComments(code).replace(/\n\s*/g, '') // remove indents & newlines
  .trim();
});
var dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

var replacer = function replacer(options) {
  var objects;
  var stack;
  var keys;
  return function replace(key, value) {
    //  very first iteration
    if (key === '') {
      keys = ['root'];
      objects = [{
        keys: 'root',
        value: value
      }];
      stack = [];
      return value;
    } // From the JSON.stringify's doc:
    // "The object in which the key was found is provided as the replacer's this parameter." thus one can control the depth


    while (stack.length && this !== stack[0]) {
      stack.shift();
      keys.pop();
    }

    if ((0, _isRegex.default)(value)) {
      if (!options.allowRegExp) {
        return undefined;
      }

      return "_regexp_".concat(value.flags, "|").concat(value.source);
    }

    if ((0, _isFunction.default)(value)) {
      if (!options.allowFunction) {
        return undefined;
      }

      var name = value.name;
      var stringified = value.toString();

      if (!stringified.match(/(\[native code\]|WEBPACK_IMPORTED_MODULE|__webpack_exports__|__webpack_require__)/)) {
        return "_function_".concat(name, "|").concat(cleanCode(stringified));
      }

      return "_function_".concat(name, "|").concat(function () {}.toString());
    }

    if ((0, _isSymbol.default)(value)) {
      if (!options.allowSymbol) {
        return undefined;
      }

      return "_symbol_".concat(value.toString().slice(7, -1));
    }

    if (typeof value === 'string' && dateFormat.test(value)) {
      if (!options.allowDate) {
        return undefined;
      }

      return "_date_".concat(value);
    }

    if (value === undefined) {
      if (!options.allowUndefined) {
        return undefined;
      }

      return '_undefined_';
    }

    if (typeof value === 'number') {
      if (value === -Infinity) {
        return '_-Infinity_';
      }

      if (value === Infinity) {
        return '_Infinity_';
      }

      if (Number.isNaN(value)) {
        return '_NaN_';
      }

      return value;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (stack.length >= options.maxDepth) {
      if (Array.isArray(value)) {
        return "[Array(".concat(value.length, ")]");
      }

      return '[Object]';
    }

    var found = objects.find(function (o) {
      return o.value === value;
    });

    if (!found) {
      if (value && (0, _isobject.default)(value) && value.constructor && value.constructor.name && value.constructor.name !== 'Object') {
        if (!options.allowClass) {
          return undefined;
        }

        try {
          Object.assign(value, {
            '_constructor-name_': value.constructor.name
          });
        } catch (e) {// immutable objects can't be written to and throw
          // we could make a deep copy but if the user values the correct instance name,
          // the user should make the deep copy themselves.
        }
      }

      keys.push(key);
      stack.unshift(value);
      objects.push({
        keys: keys.join('.'),
        value: value
      });
      return value;
    } //  actually, here's the only place where the keys keeping is useful


    return "_duplicate_".concat(found.keys);
  };
};

exports.replacer = replacer;

var reviver = function reviver() {
  var refs = [];
  var root;
  return function revive(key, value) {
    // last iteration = root
    if (key === '') {
      root = value; // restore cyclic refs

      refs.forEach(function (_ref) {
        var target = _ref.target,
            container = _ref.container,
            replacement = _ref.replacement;

        if (replacement === 'root') {
          // eslint-disable-next-line no-param-reassign
          container[target] = root;
        } else {
          // eslint-disable-next-line no-param-reassign
          container[target] = (0, _get.default)(root, replacement.replace('root.', ''));
        }
      });
    }

    if (key === '_constructor-name_') {
      return value;
    } // deal with instance names


    if ((0, _isobject.default)(value) && value['_constructor-name_']) {
      var name = value['_constructor-name_'];

      if (name !== 'Object') {
        // eslint-disable-next-line no-new-func
        var Fn = new Function("return function ".concat(name, "(){}"))();
        Object.setPrototypeOf(value, new Fn());
      } // eslint-disable-next-line no-param-reassign


      delete value['_constructor-name_'];
      return value;
    }

    if (typeof value === 'string' && value.startsWith('_function_')) {
      var _value$match = value.match(/_function_([^|]*)\|(.*)/),
          _value$match2 = _slicedToArray(_value$match, 3),
          _name = _value$match2[1],
          source = _value$match2[2]; // lazy eval of the function


      var result = function result() {
        var f = eval("(".concat(source, ")"));
        return f.apply(void 0, arguments);
      };

      Object.defineProperty(result, 'toString', {
        value: function value() {
          return source;
        }
      });
      Object.defineProperty(result, 'name', {
        value: _name
      });
      return result;
    }

    if (typeof value === 'string' && value.startsWith('_regexp_')) {
      // this split isn't working correctly
      var _value$match3 = value.match(/_regexp_([^|]*)\|(.*)/),
          _value$match4 = _slicedToArray(_value$match3, 3),
          flags = _value$match4[1],
          _source = _value$match4[2];

      return new RegExp(_source, flags);
    }

    if (typeof value === 'string' && value.startsWith('_date_')) {
      return new Date(value.replace('_date_', ''));
    }

    if (typeof value === 'string' && value.startsWith('_duplicate_')) {
      refs.push({
        target: key,
        container: this,
        replacement: value.replace('_duplicate_', '')
      });
      return null;
    }

    if (typeof value === 'string' && value.startsWith('_symbol_')) {
      return Symbol(value.replace('_symbol_', ''));
    }

    if (typeof value === 'string' && value === '_undefined_') {
      return undefined;
    }

    if (typeof value === 'string' && value === '_-Infinity_') {
      return -Infinity;
    }

    if (typeof value === 'string' && value === '_Infinity_') {
      return Infinity;
    }

    if (typeof value === 'string' && value === '_NaN_') {
      return NaN;
    }

    return value;
  };
};

exports.reviver = reviver;

var isJSON = function isJSON(input) {
  return input.match(/^[\[\{\"\}].*[\]\}\"]$/);
};

exports.isJSON = isJSON;
var defaultOptions = {
  maxDepth: 10,
  space: undefined,
  allowFunction: true,
  allowRegExp: true,
  allowDate: true,
  allowClass: true,
  allowUndefined: true,
  allowSymbol: true
};

var stringify = function stringify(data) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var mergedOptions = Object.assign({}, defaultOptions, options);
  return JSON.stringify(data, replacer(mergedOptions), options.space);
};

exports.stringify = stringify;

var parse = function parse(data) {
  return JSON.parse(data, reviver());
};

exports.parse = parse;