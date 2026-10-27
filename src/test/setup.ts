import "@testing-library/jest-dom";

// Node 25+ defines its own global localStorage, which is undefined unless
// started with --localstorage-file and hides jsdom's; use an in-memory one.
if (typeof globalThis.localStorage?.getItem !== "function") {
  const items = new Map<string, string>();
  const storage: Storage = {
    get length() { return items.size; },
    key: (index) => Array.from(items.keys())[index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: (key) => { items.delete(key); },
    clear: () => items.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
