import { vi } from "vitest";
Object.defineProperty(window, "location", {
  value: {
    href: "http://localhost:3000/",
    pathname: "/",
    search: "",
    hash: "",
    hostname: "localhost",
    port: "3000",
    protocol: "http:",
    origin: "http://localhost:3000",
  },
  writable: true,
});
Object.defineProperty(document, "referrer", {
  value: "",
  writable: true,
});
Object.defineProperty(document, "title", {
  value: "Test Page",
  writable: true,
});
Object.defineProperty(global, "performance", {
  value: {
    now: vi.fn(() => Date.now()),
  },
  writable: true,
});
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
};
Object.defineProperty(window, "localStorage", {
  value: createStorageMock(),
  writable: true,
});
Object.defineProperty(window, "sessionStorage", {
  value: createStorageMock(),
  writable: true,
});
