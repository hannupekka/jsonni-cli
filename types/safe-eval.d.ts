// declare namespace convertToObject {}
// declare function convertToObject(value: string): object;
declare module "safe-eval" {
  function saveEval(code: string, context?: object, opts?: object): any;
  export = saveEval;
}
