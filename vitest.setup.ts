/**
 * Mock localStorage for Vitest (Node) so mock API storage works.
 */
const mem: Record<string, string> = {};

const ls = {
  getItem: (k: string) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
  setItem: (k: string, v: string) => {
    mem[k] = String(v);
  },
  removeItem: (k: string) => {
    delete mem[k];
  },
  clear: () => {
    Object.keys(mem).forEach((k) => delete mem[k]);
  },
  get length() {
    return Object.keys(mem).length;
  },
  key: (i: number) => Object.keys(mem)[i] ?? null,
} as Storage;

// @ts-expect-error test shim
globalThis.localStorage = ls;
