import util from 'util';
import { exec } from 'child_process';

const execAsync = util.promisify(exec);
const binaryPath = './bin/index.js';

const getStdout = async (
  filename: string,
  query: string,
  params: string[] = []
) => {
  const command = `cat ./__test__/data/${filename} | ${binaryPath} ${params.join(
    ' '
  )} -q '${query}'`;
  const { stdout } = await execAsync(command);

  return JSON.parse(stdout);
};

describe('JSONNI', () => {
  describe('help', () => {
    test('should be printed without params', async () => {
      expect(await execAsync(binaryPath)).toMatchSnapshot();
    });

    test('should be printed with -h', async () => {
      expect(await execAsync(`${binaryPath} -h`)).toMatchSnapshot();
    });

    test('should be printed with --help', async () => {
      expect(await execAsync(`${binaryPath} --help`)).toMatchSnapshot();
    });
  });

  describe('version', () => {
    test('should be printed with -v', async () => {
      expect(await execAsync(`${binaryPath} -v`)).toMatchSnapshot();
    });

    test('should be printed with --version', async () => {
      expect(await execAsync(`${binaryPath} --version`)).toMatchSnapshot();
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

  describe('query', () => {
    describe('arrays', () => {
      const file = 'array.json';

      test.each([
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
        ['$input.name', 'Meadows Parker'],
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
  });
});
