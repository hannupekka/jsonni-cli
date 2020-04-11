import util from 'util';
import _ from 'lodash';
import { exec } from 'child_process';
import unescapeJs from 'unescape-js';
import { stripIndent } from 'common-tags';

const execAsync = util.promisify(exec);
const binaryPath = 'node ./bin/index.js';

const getStdout = async (
  filename: string,
  query: string,
  params: string[] = [],
  indent?: string
) => {
  const command = `cat ./__test__/data/${filename} | ${binaryPath} ${params.join(
    ' '
  )} -q '${query}'`;

  const { stdout } = await execAsync(command);

  // No need to parse CSV or TSV output.
  if (
    _.includes(params, '--output=csv') ||
    _.includes(params, '--output=tsv')
  ) {
    return stdout;
  }

  try {
    return indent
      ? JSON.stringify(JSON.parse(stdout), null, unescapeJs(indent))
      : JSON.parse(stdout);
  } catch (err) {
    return stdout;
  }
};

const getStderr = async (
  filename: string,
  query: string,
  params: string[] = []
) => {
  const command = `cat ./__test__/data/${filename} | ${binaryPath} ${params.join(
    ' '
  )} -q '${query}'`;

  const { stderr } = await execAsync(command);

  return stderr;
};

describe('JSONNI', () => {
  describe('help', () => {
    test('should be printed without params', async () => {
      expect(
        await execAsync(`cat __test__/data/empty.txt | ${binaryPath}`)
      ).toMatchSnapshot();
    });

    test('should be printed with query without input and show error message', async () => {
      expect(
        await execAsync(`cat __test__/data/empty.txt | ${binaryPath} -q ''`)
      ).toMatchSnapshot();
    });

    test('should be printed with invalid query and show error message', async () => {
      expect(
        await execAsync(`cat __test__/data/json.json | ${binaryPath} -q 'foo'`)
      ).toMatchSnapshot();
    });

    test('should be printed with -h', async () => {
      expect(await execAsync(`${binaryPath} -h`)).toMatchSnapshot();
    });

    test('should be printed with --help', async () => {
      expect(await execAsync(`${binaryPath} --help`)).toMatchSnapshot();
    });
  });

  describe('minify', () => {
    const file = 'object.json';
    const query = '_.pick($input, ["name", "age"])';

    test('should minify output with -m', async () => {
      const command = `cat ./__test__/data/${file} | ${binaryPath} -m -q '${query}'`;
      const { stdout } = await execAsync(command);
      expect(stdout).toMatchSnapshot();
    });

    test('should minify output with --minify', async () => {
      const command = `cat ./__test__/data/${file} | ${binaryPath} --minify -q '${query}'`;
      const { stdout } = await execAsync(command);
      expect(stdout).toMatchSnapshot();
    });
  });

  describe('indent', () => {
    const file = 'json.json';
    const query = '$input';

    test('should indent output with --indent', async () => {
      expect(
        await getStdout(file, query, ['--indent=" "'], ' ')
      ).toMatchSnapshot();
      expect(
        await getStdout(file, query, ['--indent="\t\t"'], '\t\t')
      ).toMatchSnapshot();
    });
  });

  describe('query', () => {
    describe('dot notation access', () => {
      const file = 'json.json';

      test.each([
        ['$input.0._id', 1],
        ['$input.0.hasOwnProperty("_id")', true],
        [
          '_.map($input.0, i => i)',
          [1, false, 30, 'Meadows Parker', '2017-10-03T09:23:04 -03:00']
        ],
        [
          '_.chain($input.0).map(i => i)',
          [1, false, 30, 'Meadows Parker', '2017-10-03T09:23:04 -03:00']
        ],
        [
          'from($input.0).map(i => i).toArray()',
          [
            ['_id', 1],
            ['isActive', false],
            ['age', 30],
            ['name', 'Meadows Parker'],
            ['registered', '2017-10-03T09:23:04 -03:00']
          ]
        ]
      ])('%s', async (query: string, result: any) => {
        expect(await getStdout(file, query)).toEqual(result);
      });
    });

    describe('arrays', () => {
      const file = 'array.json';

      test.each([
        ['', [1, 2, 3, 4, 5]],
        ['$input.map(i => i * 2)', [2, 4, 6, 8, 10]],
        ['$input.map(i => i * 2).filter(i => i > 4)', [6, 8, 10]],
        ['_.map($input, i => i * 2)', [2, 4, 6, 8, 10]],
        ['_.chain($input).map(i => i * 2).filter(i => i > 4)', [6, 8, 10]],
        ['_.filter(_.map($input, i => i * 2), i => i > 4)', [6, 8, 10]],
        ['from($input).map(i => i * 2).toArray()', [2, 4, 6, 8, 10]],
        [
          'from($input).map(i => i * 2).filter(i => i > 4).toArray()',
          [6, 8, 10]
        ]
      ])('%s', async (query: string, result: number[]) => {
        expect(await getStdout(file, query)).toEqual(result);
      });
    });

    describe('objects', () => {
      const file = 'object.json';

      test.each([
        [
          '',
          {
            _id: '5ca1b4b8b4e4a3bbcc29b3b0',
            isActive: false,
            age: 30,
            name: 'Meadows Parker',
            registered: '2017-10-03T09:23:04 -03:00'
          }
        ],
        ['_.pick($input, ["name", "age"])', { name: 'Meadows Parker', age: 30 }]
      ])('%s', async (query: string, result: any) => {
        expect(await getStdout(file, query)).toEqual(result);
      });
    });

    describe('JSON', () => {
      const file = 'json.json';

      test.each([
        ['$input.filter(i => i.isActive).map(i => i._id)', [2, 3, 4]],
        ['$input.map(i => i.isActive)', [false, true, true, true, false]],
        ['_.chain($input).filter("isActive").map("_id")', [2, 3, 4]],
        ['_.chain($input).map("isActive")', [false, true, true, true, false]],
        [
          'from($input).filter(i => i.isActive).map(i => i._id).toArray()',
          [2, 3, 4]
        ],
        [
          'from($input).map(i => i.isActive).toArray()',
          [false, true, true, true, false]
        ]
      ])('%s', async (query: string, result: any) => {
        expect(await getStdout(file, query)).toEqual(result);
      });
    });

    describe('JSON (as joined string)', () => {
      const file = 'json.json';

      test.each([['$input[0].name'], ['$input.map(i => i.name).join("\\n")']])(
        '%s',
        async (query: string) => {
          expect(await getStdout(file, query)).toMatchSnapshot();
        }
      );
    });

    describe('JSON (minified)', () => {
      const file = 'jsonMinified.json';

      test.each([
        ['$input.filter(i => i.isActive).map(i => i._id)', [2, 3, 4]],
        ['$input.map(i => i.isActive)', [false, true, true, true, false]],
        ['_.chain($input).filter("isActive").map("_id")', [2, 3, 4]],
        ['_.chain($input).map("isActive")', [false, true, true, true, false]],
        [
          'from($input).filter(i => i.isActive).map(i => i._id).toArray()',
          [2, 3, 4]
        ],
        [
          'from($input).map(i => i.isActive).toArray()',
          [false, true, true, true, false]
        ]
      ])('%s', async (query: string, result: any) => {
        expect(await getStdout(file, query)).toEqual(result);
      });
    });

    describe('CSV', () => {
      const file = 'csv.csv';

      test.each([
        ['$input.filter(i => i.isActive).map(i => i._id)', [2, 3, 4]],
        ['$input.map(i => i.isActive)', [false, true, true, true, false]],
        ['_.chain($input).filter("isActive").map("_id")', [2, 3, 4]],
        ['_.chain($input).map("isActive")', [false, true, true, true, false]],
        [
          'from($input).filter(i => i.isActive).map(i => i._id).toArray()',
          [2, 3, 4]
        ],
        [
          'from($input).map(i => i.isActive).toArray()',
          [false, true, true, true, false]
        ]
      ])('%s', async (query: string, result: any) => {
        expect(await getStdout(file, query, ['--input=csv'])).toEqual(result);
      });
    });

    describe('CSV (custom delimiter)', () => {
      const file = 'csvCustomDelimiter.csv';

      test.each([
        ['$input.filter(i => i.isActive).map(i => i._id)', [2, 3, 4]],
        ['$input.map(i => i.isActive)', [false, true, true, true, false]],
        ['_.chain($input).filter("isActive").map("_id")', [2, 3, 4]],
        ['_.chain($input).map("isActive")', [false, true, true, true, false]],
        [
          'from($input).filter(i => i.isActive).map(i => i._id).toArray()',
          [2, 3, 4]
        ],
        [
          'from($input).map(i => i.isActive).toArray()',
          [false, true, true, true, false]
        ]
      ])('%s', async (query: string, result: any) => {
        expect(
          await getStdout(file, query, ['--input=csv', '--input-delimiter "|"'])
        ).toEqual(result);
      });
    });

    describe('CSV (without header line)', () => {
      const file = 'csvWithoutHeaders.csv';

      test.each([
        ['$input.filter(i => i.isActive).map(i => i._id)', [2, 3, 4]],
        ['$input.map(i => i.isActive)', [false, true, true, true, false]],
        ['_.chain($input).filter("isActive").map("_id")', [2, 3, 4]],
        ['_.chain($input).map("isActive")', [false, true, true, true, false]],
        [
          'from($input).filter(i => i.isActive).map(i => i._id).toArray()',
          [2, 3, 4]
        ],
        [
          'from($input).map(i => i.isActive).toArray()',
          [false, true, true, true, false]
        ]
      ])('%s', async (query: string, result: any) => {
        expect(
          await getStdout(file, query, [
            '--input=csv',
            '--input-header=_id,isActive,age,name,registered'
          ])
        ).toEqual(result);
      });
    });

    describe('TSV', () => {
      const file = 'tsv.tsv';

      test.each([
        ['$input.filter(i => i.isActive).map(i => i._id)', [2, 3, 4]],
        ['$input.map(i => i.isActive)', [false, true, true, true, false]],
        ['_.chain($input).filter("isActive").map("_id")', [2, 3, 4]],
        ['_.chain($input).map("isActive")', [false, true, true, true, false]],
        [
          'from($input).filter(i => i.isActive).map(i => i._id).toArray()',
          [2, 3, 4]
        ],
        [
          'from($input).map(i => i.isActive).toArray()',
          [false, true, true, true, false]
        ]
      ])('%s', async (query: string, result: any) => {
        expect(await getStdout(file, query, ['--input=tsv'])).toEqual(result);
      });
    });

    describe('TSV (without header line)', () => {
      const file = 'tsvWithoutHeaders.tsv';

      test.each([
        ['$input.filter(i => i.isActive).map(i => i._id)', [2, 3, 4]],
        ['$input.map(i => i.isActive)', [false, true, true, true, false]],
        ['_.chain($input).filter("isActive").map("_id")', [2, 3, 4]],
        ['_.chain($input).map("isActive")', [false, true, true, true, false]],
        [
          'from($input).filter(i => i.isActive).map(i => i._id).toArray()',
          [2, 3, 4]
        ],
        [
          'from($input).map(i => i.isActive).toArray()',
          [false, true, true, true, false]
        ]
      ])('%s', async (query: string, result: any) => {
        expect(
          await getStdout(file, query, [
            '--input=tsv',
            '--input-header=_id,isActive,age,name,registered'
          ])
        ).toEqual(result);
      });
    });

    describe('JSON -> CSV', () => {
      test('should produce CSV from JSON', async () => {
        expect(await getStdout('json.json', '$input[0]', ['--output=csv']))
          .toMatch(stripIndent`
            "_id","isActive","age","name","registered"
            1,false,30,"Meadows Parker","2017-10-03T09:23:04 -03:00"
          `);
      });
    });

    describe('CSV -> CSV', () => {
      test('should produce CSV from CSV', async () => {
        expect(
          await getStdout('csvCustomDelimiter.csv', '$input[0]', [
            '--input=csv',
            '--input-delimiter="|"',
            '--output=csv',
            '--output-delimiter=,'
          ])
        ).toMatch(stripIndent`
          "_id","isActive","age","name","registered"
          1,false,30,"Meadows Parker","2017-10-03T09:23:04 -03:00"
        `);
      });
    });

    describe('CSV -> TSV', () => {
      test('should produce TSV from CSV', async () => {
        expect(
          await getStdout('csv.csv', '$input[0]', [
            '--input=csv',
            '--output=tsv'
          ])
        ).toMatch(stripIndent`
          "_id"	"isActive"	"age"	"name"	"registered"
          1	false	30	"Meadows Parker"	"2017-10-03T09:23:04 -03:00"
        `);
      });
    });

    describe('CSV -> CSV (without header line)', () => {
      test('should produce CSV from CSV', async () => {
        expect(
          await getStdout('csvWithoutHeaders.csv', '$input[0]', [
            '--input=csv',
            '--input-header=_id,isActive,age,name,registered',
            '--output=csv'
          ])
        ).toMatch(stripIndent`
          "_id","isActive","age","name","registered"
          1,false,30,"Meadows Parker","2017-10-03T09:23:04 -03:00"
        `);
      });
    });

    describe('CSV -> TSV (without header line)', () => {
      test('should produce TSV from CSV', async () => {
        expect(
          await getStdout('csvWithoutHeaders.csv', '$input[0]', [
            '--input=csv',
            '--input-header=_id,isActive,age,name,registered',
            '--output=tsv'
          ])
        ).toMatch(stripIndent`
          "_id"	"isActive"	"age"	"name"	"registered"
          1	false	30	"Meadows Parker"	"2017-10-03T09:23:04 -03:00"
        `);
      });
    });

    describe('JSON -> TSV', () => {
      test('should produce TSV from JSON', async () => {
        expect(await getStdout('json.json', '$input[0]', ['--output=tsv']))
          .toMatch(stripIndent`
          "_id"	"isActive"	"age"	"name"	"registered"
          1	false	30	"Meadows Parker"	"2017-10-03T09:23:04 -03:00"
        `);
      });
    });

    describe('TSV -> TSV', () => {
      test('should produce TSV from TSV', async () => {
        expect(
          await getStdout('tsv.tsv', '$input[0]', [
            '--input=tsv',
            '--output=tsv'
          ])
        ).toMatch(stripIndent`
          "_id"	"isActive"	"age"	"name"	"registered"
          1	false	30	"Meadows Parker"	"2017-10-03T09:23:04 -03:00"
        `);
      });
    });

    describe('TSV -> CSV', () => {
      test('should produce CSV from TSV', async () => {
        expect(
          await getStdout('tsv.tsv', '$input[0]', [
            '--input=tsv',
            '--output=csv',
            '--output-delimiter="|"'
          ])
        ).toMatch(stripIndent`
          "_id"|"isActive"|"age"|"name"|"registered"
          1|false|30|"Meadows Parker"|"2017-10-03T09:23:04 -03:00"
        `);
      });
    });

    describe('TSV -> TSV (without header line)', () => {
      test('should produce TSV from TSV', async () => {
        expect(
          await getStdout('tsvWithoutHeaders.tsv', '$input[0]', [
            '--input=tsv',
            '--input-header=_id,isActive,age,name,registered',
            '--output=tsv'
          ])
        ).toMatch(stripIndent`
          "_id"	"isActive"	"age"	"name"	"registered"
          1	false	30	"Meadows Parker"	"2017-10-03T09:23:04 -03:00"
        `);
      });
    });

    describe('TSV -> CSV (without header line)', () => {
      test('should produce CSV from TSV', async () => {
        expect(
          await getStdout('tsvWithoutHeaders.tsv', '$input[0]', [
            '--input=tsv',
            '--input-header=_id,isActive,age,name,registered',
            '--output=csv'
          ])
        ).toMatch(stripIndent`
          "_id","isActive","age","name","registered"
          1,false,30,"Meadows Parker","2017-10-03T09:23:04 -03:00"
        `);
      });
    });

    describe('errors', () => {
      test('should print on invalid query', async () => {
        expect(await getStderr('json.json', 'foo', [])).toMatch(
          'Invalid query'
        );
      });

      test('should print on invalid input format', async () => {
        expect(await getStderr('json.json', '$input', ['--input=foo'])).toMatch(
          'Invalid input format'
        );
      });

      test('should print on invalid output format', async () => {
        expect(
          await getStderr('json.json', '$input', ['--output=foo'])
        ).toMatch('Invalid output format');
      });
    });
  });
});
