#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var stringify_object_1 = __importDefault(require("stringify-object"));
var safe_eval_1 = __importDefault(require("safe-eval"));
var get_stdin_1 = __importDefault(require("get-stdin"));
var commander_1 = __importDefault(require("commander"));
var consola_1 = __importDefault(require("consola"));
var lodash_1 = __importDefault(require("lodash"));
var fromfrom_1 = require("fromfrom");
var jsonminify_1 = __importDefault(require("jsonminify"));
var packageInfo = require('../package.json');
/**
 * Checks if given string is JSON.
 * @param {string} input Input to check.
 * @returns {boolean}
 */
var isJSON = function (input) {
    try {
        JSON.parse(input);
        return true;
    }
    catch (e) {
        return false;
    }
};
// /**
//  * Parses input and returns it as string.
//  * @param {string} input Input
//  * @returns {string}
//  */
// const parseInput = (input: string): string => {
//   const isInputJSON: boolean = isJSON(input);
//   return isInputJSON
//     ? JSON.stringify(JSON.parse(input))
//     : stringifyObject(convertToObject(input), { singleQuotes: false });
// };
/**
 * Get query value and context
 * @param {String} input Input value
 * @param {String} value Query value
 * @returns {object|null}
 */
var parseQueryValueAndContext = function (input, query) {
    var queryValue = lodash_1.default.trimEnd(query, ';');
    // ES6
    if (queryValue.startsWith('$input.')) {
        return {
            queryValue: queryValue.replace('$input.', input + "."),
            context: null
        };
    }
    // Lodash
    if (queryValue.startsWith('_.')) {
        var isChained = queryValue.startsWith('_.chain(');
        var queryValueSuffix = isChained ? '.value()' : '';
        return {
            queryValue: queryValue.replace('$input', "" + input) + queryValueSuffix,
            context: lodash_1.default
        };
    }
    // fromfrom
    if (queryValue.startsWith('from')) {
        return {
            queryValue: queryValue.replace('$input', input),
            context: { from: fromfrom_1.from }
        };
    }
    // Unsupported query.
    return null;
};
/**
 * Evaluates query.
 * @param {string} input Input
 * @param {Query} query Query
 *
 */
var evaluateQuery = function (input, query) {
    var queryValue = query.queryValue, context = query.context;
    try {
        var evalQuery = safe_eval_1.default(queryValue, context);
        var isInputJSON = isJSON(input);
        return isInputJSON
            ? JSON.stringify(evalQuery, null, 2)
            : stringify_object_1.default(evalQuery, { singleQuotes: false });
    }
    catch (e) {
        consola_1.default.error(e.toString());
        process.exit(0);
    }
};
(function () { return __awaiter(_this, void 0, void 0, function () {
    var program, query, shouldMinify, input, queryContext, evaluated, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                program = commander_1.default
                    .version(packageInfo.version, '-v, --version')
                    .option('-m --minify', 'Minify output')
                    .option('-q --query <query>', 'Query to transorm data with')
                    .parse(process.argv);
                program.on('--help', function () {
                    console.log('');
                    console.log('Examples:');
                    console.log("  $ cat data.json | jsonni -q '$input.map(i => i.name)'");
                    console.log('');
                });
                query = program.query;
                shouldMinify = program.minify;
                // If no query, show help and exit.
                if (lodash_1.default.isNil(query)) {
                    program.help();
                }
                return [4 /*yield*/, get_stdin_1.default()];
            case 1:
                input = _a.sent();
                queryContext = parseQueryValueAndContext(input, query);
                evaluated = evaluateQuery(input, queryContext);
                result = shouldMinify ? jsonminify_1.default(evaluated) : evaluated;
                console.log(result);
                return [2 /*return*/];
        }
    });
}); })();
