import stringifyObject from 'stringify-object';
import safeEval from 'safe-eval';
import getStdin from 'get-stdin';
import commander from 'commander';
import consola from 'consola';
import _ from 'lodash';
import { from } from 'fromfrom';
import jsonMinify from 'jsonminify';
import csv from 'csvtojson';

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

  // Unsupported query.
  return null;
};

/**
 * Evaluates query.
 * @param {string} input Input
 * @param {Query} query Query
 *
 */
const evaluateQuery = (input: string, query: Query) => {
  const { queryValue, context } = query;

  try {
    const evalQuery = safeEval(queryValue, context);
    const isInputJSON = isJSON(input);

    return isInputJSON
      ? JSON.stringify(evalQuery, null, 2)
      : stringifyObject(evalQuery, { singleQuotes: false });
  } catch (e) {
    consola.error(e.toString());
    process.exit(0);
  }
};

(async () => {
  // Handle arguments.
  const program = commander
    .version(packageInfo.version, '-v, --version')
    .option('--csv', 'use CSV as input data')
    .option(
      '--delimiter <delimiter>',
      'CSV delimiter character, defaults to ";"'
    )
    .option('--tsv', 'use TSV as input data')
    .option('--headers <headers>', 'CSV headers, separated with ","')
    .option('-m --minify', 'minify output')
    .option('-q --query <query>', 'query to transorm data with')
    .parse(process.argv);

  program.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log("  $ cat data.json | jsonni -q '$input.map(i => i.name)'");
    console.log('');
  });

  // Get query string to be executed against input.
  const query = program.query;
  const shouldMinify = program.minify;
  const useCSV = program.csv;
  const useTSV = program.tsv;
  const delimiter = useTSV ? '\t' : program.delimiter || ';';
  const headers = program.headers;

  // If no query, show help and exit.
  if (_.isNil(query) || query === '') {
    program.help();
  }

  // Read input from stdin.
  let input = await getStdin();

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
  const evaluated = evaluateQuery(input, queryContext);

  const result = shouldMinify ? jsonMinify(evaluated) : evaluated;

  console.log(result);
})();
