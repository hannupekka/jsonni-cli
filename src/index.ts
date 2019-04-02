import stringifyObject from 'stringify-object';
import safeEval from 'safe-eval';
import getStdin from 'get-stdin';
import commander from 'commander';
import chalk from 'chalk';
import _ from 'lodash';
import { from } from 'fromfrom';
import jsonMinify from 'jsonminify';
import csv from 'csvtojson';
import unescapeJs from 'unescape-js';

const logger = (message: string) => console.error(`\n${chalk.red(message)}\n`);

const packageInfo = require('../package.json');

interface Query {
  queryValue: string;
  context: object;
}

/**
 * Checks if given string is JSON.
 * @param {string} input Input to check.
 * @returns {boolean}
 */
const isJSON = (input: string): boolean => {
  try {
    JSON.parse(input);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Get query value and context
 * @param {String} input Input value
 * @param {String} value Query value
 * @returns {object|null}
 */
const parseQueryValueAndContext = (input: string, query: string): Query => {
  const queryValue = _.trimEnd(query, ';');

  // ES6
  if (queryValue.startsWith('$input.')) {
    return {
      queryValue: queryValue.replace('$input.', `${input}.`),
      context: null
    };
  }

  // Lodash
  if (queryValue.startsWith('_.')) {
    const isChained = queryValue.startsWith('_.chain(');
    const queryValueSuffix = isChained ? '.value()' : '';
    return {
      queryValue: queryValue.replace('$input', `${input}`) + queryValueSuffix,
      context: _
    };
  }

  // fromfrom
  if (queryValue.startsWith('from')) {
    return {
      queryValue: queryValue.replace('$input', input),
      context: { from }
    };
  }

  // Empty query, just return input.
  if (_.includes(['', '$input'], queryValue)) {
    return {
      queryValue: `${input}.map(i => i)`,
      context: null
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
const evaluateQuery = (input: string, query: Query, indent: string = '  ') => {
  const { queryValue, context } = query;

  const unescapedIndent = unescapeJs(indent);

  try {
    const evalQuery = safeEval(queryValue, context);
    const isInputJSON = isJSON(input);

    return isInputJSON
      ? JSON.stringify(evalQuery, null, unescapedIndent)
      : stringifyObject(evalQuery, {
          indent: unescapedIndent,
          singleQuotes: false
        });
  } catch (e) {
    logger(e.toString());
    process.exit(0);
  }
};

(async () => {
  // Handle arguments.
  const program = commander
    .version(packageInfo.version, '-v, --version')
    .option('-i --indent <indent>', 'output indentation, defaults to "  "')
    .option('-m --minify', 'minify output')
    .option('-q --query <query>', 'query to transform data with')
    .option('--csv', 'use CSV as input data')
    .option('--tsv', 'use TSV as input data')
    .option(
      '--delimiter <delimiter>',
      'CSV/TSV delimiter character. Defaults to ";"'
    )
    .option(
      '--headers <headers>',
      'CSV/TSV headers, indicates that input does not have headers. Separated with ","'
    )
    .parse(process.argv);

  program.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ cat data.json | jsonni');
    console.log("  $ cat data.json | jsonni -q '$input.map(i => i.name)'");
    console.log('');
    console.log('  $ cat data.csv | jsonni --csv ');
    console.log("  $ cat data.csv | jsonni --csv --delimiter=',' ");
    console.log(
      '  $ cat dataWithoutHeaders.csv | jsonni --csv --headers=_id,isActive,age,name,registered'
    );
    console.log('');
    console.log('  $ cat data.tsv | jsonni --tsv');
    console.log(
      '  $ cat dataWithoutHeaders.tsv | jsonni --tsv --headers=_id,isActive,age,name,registered'
    );
    console.log('');
  });

  // Get query string to be executed against input.
  const query = program.query;
  const indent = program.indent;
  const shouldMinify = program.minify;
  const useCSV = program.csv;
  const useTSV = program.tsv;
  const delimiter = useTSV ? '\t' : program.delimiter || ';';
  const headers = program.headers;

  // Read input from stdin.
  let input = await getStdin();
  if (input.length === 0) {
    if (!_.isNil(query)) {
      logger('Input missing');
    }

    // If no input, show help and exit.
    program.help();
  }

  if (useCSV || useTSV) {
    const csvOptions = {
      delimiter,
      checkType: true,
      ...(headers && { headers: headers.split(',') }),
      ...(headers && { noheader: true })
    };

    input = JSON.stringify(await csv(csvOptions).fromString(input));
  }

  const queryContext = parseQueryValueAndContext(input, query);

  if (_.isNil(queryContext)) {
    logger('Invalid query');
    program.help();
  }

  const evaluated = evaluateQuery(input, queryContext, indent);

  const result = shouldMinify ? jsonMinify(evaluated) : evaluated;

  console.log(result);
})();
