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
import { parse } from 'json2csv';

const logger = (message: string) => console.error(`\n${chalk.red(message)}\n`);
const packageInfo = require('../package.json');

const ALLOWED_FORMATS = ['csv', 'tsv', 'json'];

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
  if (queryValue.startsWith('$input')) {
    return {
      queryValue: queryValue.replace('$input', `${input}`),
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
      queryValue: input,
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
    .option('-m --minify', 'minify output')
    .option('-q --query <query>', 'query to transform data with')
    .option(
      '--input <format>',
      'input format. Available formats: json, tsv, csv'
    )
    .option(
      '--input-header <header>',
      'input CSV/TSV headers. Separated with ","'
    )
    .option(
      '--input-delimiter <delimiter>',
      'CSV/TSV input delimiter character. Defaults to ","'
    )
    .option(
      '--output <format>',
      'output format. Available formats: json, tsv, csv'
    )
    .option(
      '--output-delimiter <delimiter>',
      'CSV/TSV output delimiter character. Defaults to ","'
    )
    .option('--indent <indent>', 'output indentation, defaults to "  "')
    .parse(process.argv);

  program.on('--help', () => {
    console.log('');
  });

  // Get query string to be executed against input.
  const query = program.query;
  const shouldMinify = program.minify;

  const inputFormat: string = program.input || 'json';
  const inputHeader: string = program.inputHeader;
  const inputDelimiter: string =
    program.inputDelimiter ||
    (inputFormat.toLowerCase() === 'tsv' ? '\t' : ',');

  const outputFormat: string = program.output || 'json';
  const outputDelimiter: string =
    program.outputDelimiter ||
    (outputFormat.toLowerCase() === 'tsv' ? '\t' : ',');

  const indent: string = program.indent;

  if (!_.includes(ALLOWED_FORMATS, inputFormat)) {
    logger('Invalid input format');
    program.help();
  }

  if (!_.includes(ALLOWED_FORMATS, outputFormat)) {
    logger('Invalid output format');
    program.help();
  }

  // Read input from stdin.
  let input = await getStdin();
  if (input.length === 0) {
    if (!_.isNil(query)) {
      logger('Input missing');
    }

    // If no input, show help and exit.
    program.help();
  }

  // Final result.
  let result;

  // Input data is CSV/TSV.
  if (_.includes(['csv', 'tsv'], inputFormat.toLowerCase())) {
    const csvOptions = {
      delimiter: unescapeJs(inputDelimiter),
      checkType: true,
      ...(inputHeader && { headers: inputHeader.split(',') }),
      ...(inputHeader && { noheader: true })
    };

    input = JSON.stringify(await csv(csvOptions).fromString(input));
  }

  // Parse query and context.
  const queryContext = parseQueryValueAndContext(input, query);

  if (_.isNil(queryContext)) {
    logger('Invalid query');
    program.help();
  }

  // Evaluate query agains data.
  const evaluated = evaluateQuery(input, queryContext, indent);

  if (outputFormat.toLowerCase() === 'json') {
    result = shouldMinify ? jsonMinify(evaluated) : evaluated;
  } else {
    const json = JSON.parse(evaluated);

    result = parse(json, {
      delimiter: unescapeJs(outputDelimiter),
      ...(inputHeader && { fields: inputHeader.split(',') })
    });
  }

  const output =
    outputFormat.toLowerCase() === 'json'
      ? _.trim(unescapeJs(result), '"')
      : result;

  console.log(output);
})().catch(e => {
  logger(e.toString());
});
