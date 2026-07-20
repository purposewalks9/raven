export interface Router {
  push(path: string): void;
  replace(path: string): void;
}
// Placeholder — real implementation wraps History API / framework adapter.
export const router: Router = {
  push: (path) => { throw new Error(`@nova/router: push("${path}") not implemented yet`); },
  replace: (path) => { throw new Error(`@nova/router: replace("${path}") not implemented yet`); },
};
