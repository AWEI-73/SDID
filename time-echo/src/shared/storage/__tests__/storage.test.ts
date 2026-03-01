// Unit test for storage module
// localStorage is not available in Node, so we mock it

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock, writable: true });

import { storageGet, storageSet, storageRemove, storageClear } from "../storage";

describe("storage", () => {
  beforeEach(() => localStorageMock.clear());

  it("storageSet should persist value", () => {
    const ok = storageSet("key1", { foo: "bar" });
    expect(ok).toBe(true);
    expect(localStorageMock.getItem("key1")).toBe('{"foo":"bar"}');
  });

  it("storageGet should retrieve persisted value", () => {
    storageSet("key2", [1, 2, 3]);
    expect(storageGet<number[]>("key2")).toEqual([1, 2, 3]);
  });

  it("storageGet should return null for missing key", () => {
    expect(storageGet("missing")).toBeNull();
  });

  it("storageRemove should delete key", () => {
    storageSet("key3", "hello");
    storageRemove("key3");
    expect(storageGet("key3")).toBeNull();
  });
});