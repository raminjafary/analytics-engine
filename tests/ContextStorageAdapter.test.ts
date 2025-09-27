import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ContextStorageAdapter,
  BrowserStorageAdapter,
  MemoryStorageAdapter,
  type ContextData,
} from "../src/storage/ContextStorageAdapter";
import type { UTMParameters } from "../src/types/IAnalyticsEvent";
describe("ContextStorageAdapter", () => {
  let originalWindow: (Window & typeof globalThis) | undefined;
  let originalSessionStorage: Storage | undefined;
  let originalLocalStorage: Storage | undefined;
  beforeEach(() => {
    originalWindow = global.window;
    originalSessionStorage = global.sessionStorage;
    originalLocalStorage = global.localStorage;
    global.window = {
      sessionStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      },
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      },
    } as unknown as Window & typeof globalThis;
    global.sessionStorage = global.window.sessionStorage;
    global.localStorage = global.window.localStorage;
  });
  afterEach(() => {
    if (originalWindow) {
      global.window = originalWindow;
    }
    if (originalSessionStorage) {
      global.sessionStorage = originalSessionStorage;
    }
    if (originalLocalStorage) {
      global.localStorage = originalLocalStorage;
    }
  });
  describe("BrowserStorageAdapter", () => {
    it("should store and retrieve data from session storage", () => {
      const adapter = new BrowserStorageAdapter({
        storageType: "session",
        cacheKey: "test_cache",
        ttl: 30000,
        enabled: true,
      });
      const testData: ContextData = {
        utm: {
          utm_source: "google",
          utm_medium: "cpc",
        },
        globalProperties: {
          app_version: "1.0.0",
        },
        customProperty: "test_value",
      };
      adapter.set("test_key", testData);
      expect(global.sessionStorage.setItem).toHaveBeenCalledWith(
        "test_key",
        expect.stringContaining('"utm_source":"google"'),
      );
      const mockCachedData = {
        data: testData,
        timestamp: Date.now(),
        expiresAt: Date.now() + 30000,
      };
      (
        global.sessionStorage.getItem as ReturnType<typeof vi.fn>
      ).mockReturnValue(JSON.stringify(mockCachedData));
      const retrieved = adapter.get("test_key");
      expect(retrieved).toEqual(testData);
    });
    it("should handle expired cache data", () => {
      const adapter = new BrowserStorageAdapter({
        storageType: "session",
        cacheKey: "test_cache",
        ttl: 30000,
        enabled: true,
      });
      const mockExpiredData = {
        data: { utm: { utm_source: "google" } },
        timestamp: Date.now() - 60000,
        expiresAt: Date.now() - 30000,
      };
      (
        global.sessionStorage.getItem as ReturnType<typeof vi.fn>
      ).mockReturnValue(JSON.stringify(mockExpiredData));
      const retrieved = adapter.get("test_key");
      expect(retrieved).toBeNull();
      expect(global.sessionStorage.removeItem).toHaveBeenCalledWith("test_key");
    });
    it("should handle storage errors gracefully", () => {
      const adapter = new BrowserStorageAdapter({
        storageType: "session",
        cacheKey: "test_cache",
        ttl: 30000,
        enabled: true,
      });
      (
        global.sessionStorage.setItem as ReturnType<typeof vi.fn>
      ).mockImplementation(() => {
        throw new Error("Storage quota exceeded");
      });
      const testData: ContextData = {
        utm: { utm_source: "google" },
      };
      expect(() => adapter.set("test_key", testData)).not.toThrow();
    });
  });
  describe("MemoryStorageAdapter", () => {
    it("should store and retrieve data in memory", () => {
      const adapter = new MemoryStorageAdapter(true);
      const testData: ContextData = {
        utm: { utm_source: "facebook" },
        globalProperties: { user_id: "123" },
      };
      adapter.set("test_key", testData);
      const retrieved = adapter.get("test_key");
      expect(retrieved).toEqual(testData);
    });
    it("should handle expired data", () => {
      const adapter = new MemoryStorageAdapter(true);
      const testData: ContextData = { utm: { utm_source: "google" } };
      adapter.set("test_key", testData);
      const cache = (
        adapter as unknown as {
          cache: Map<
            string,
            { data: ContextData; timestamp: number; expiresAt: number }
          >;
        }
      ).cache;
      const cachedItem = cache.get("test_key");
      if (cachedItem) {
        cachedItem.expiresAt = Date.now() - 1000;
        cache.set("test_key", cachedItem);
      }
      const retrieved = adapter.get("test_key");
      expect(retrieved).toBeNull();
    });
    it("should clear all data", () => {
      const adapter = new MemoryStorageAdapter(true);
      adapter.set("key1", { utm: { utm_source: "google" } });
      adapter.set("key2", { utm: { utm_source: "facebook" } });
      expect(adapter.get("key1")).not.toBeNull();
      expect(adapter.get("key2")).not.toBeNull();
      adapter.clearAll();
      expect(adapter.get("key1")).toBeNull();
      expect(adapter.get("key2")).toBeNull();
    });
  });
  describe("ContextStorageAdapter", () => {
    it("should use browser storage by default", () => {
      const adapter = new ContextStorageAdapter();
      expect(adapter.isEnabled()).toBe(true);
      const testData: ContextData = {
        utm: { utm_source: "google" },
      };
      adapter.set(testData);
      expect(global.sessionStorage.setItem).toHaveBeenCalled();
    });
    it("should use custom storage implementation", () => {
      const customStorage = new MemoryStorageAdapter(true);
      const adapter = new ContextStorageAdapter(customStorage);
      const testData: ContextData = {
        utm: { utm_source: "google" },
        globalProperties: { app_version: "1.0.0" },
      };
      adapter.set(testData);
      const retrieved = adapter.get();
      expect(retrieved).toEqual(testData);
    });
    it("should provide helper methods for specific data types", () => {
      const adapter = new ContextStorageAdapter();
      const utm: UTMParameters = {
        utm_source: "google",
        utm_medium: "cpc",
      };
      const globalProps = {
        app_version: "1.0.0",
        platform: "web",
      };
      adapter.setUTM(utm);
      adapter.setGlobalProperties(globalProps);
      adapter.setProperty("customKey", "customValue");
      const mockData = {
        utm,
        globalProperties: globalProps,
        customKey: "customValue",
      };
      (
        global.sessionStorage.getItem as ReturnType<typeof vi.fn>
      ).mockReturnValue(
        JSON.stringify({
          data: mockData,
          timestamp: Date.now(),
          expiresAt: Date.now() + 30000,
        }),
      );
      expect(adapter.getUTM()).toEqual(utm);
      expect(adapter.getGlobalProperties()).toEqual(globalProps);
      expect(adapter.getProperty<string>("customKey")).toBe("customValue");
    });
    it("should provide factory methods", () => {
      const browserAdapter = ContextStorageAdapter.createBrowserStorage({
        storageType: "local",
        ttl: 60000,
      });
      expect(browserAdapter.isEnabled()).toBe(true);
      const memoryAdapter = ContextStorageAdapter.createMemoryStorage(true);
      expect(memoryAdapter.isEnabled()).toBe(true);
      const customStorage = new MemoryStorageAdapter(true);
      const customAdapter = ContextStorageAdapter.createCustomStorage(
        customStorage,
        { cacheKey: "custom_cache" },
      );
      expect(customAdapter.isEnabled()).toBe(true);
    });
    it("should merge data when setting properties", () => {
      const adapter = new ContextStorageAdapter();
      const existingData = {
        utm: { utm_source: "google" },
        globalProperties: { app_version: "1.0.0" },
      };
      (
        global.sessionStorage.getItem as ReturnType<typeof vi.fn>
      ).mockReturnValue(
        JSON.stringify({
          data: existingData,
          timestamp: Date.now(),
          expiresAt: Date.now() + 30000,
        }),
      );
      adapter.setUTM({ utm_source: "facebook", utm_medium: "social" });
      expect(global.sessionStorage.setItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"utm_source":"facebook"'),
      );
    });
  });
  describe("Configuration", () => {
    it("should handle disabled storage", () => {
      const adapter = new ContextStorageAdapter(undefined, {
        enabled: false,
      });
      expect(adapter.isEnabled()).toBe(false);
      const testData: ContextData = { utm: { utm_source: "google" } };
      adapter.set(testData);
      expect(global.sessionStorage.setItem).not.toHaveBeenCalled();
    });
    it("should update configuration", () => {
      const adapter = new ContextStorageAdapter(undefined, {
        storageType: "session",
        ttl: 30000,
      });
      const initialConfig = adapter.getConfig();
      expect(initialConfig.storageType).toBe("session");
      adapter.updateConfig({ storageType: "local", ttl: 60000 });
      const updatedConfig = adapter.getConfig();
      expect(updatedConfig.storageType).toBe("local");
      expect(updatedConfig.ttl).toBe(60000);
    });
  });
  describe("Server-side environment", () => {
    it("should handle server-side environment gracefully", () => {
      const originalWindow = global.window;
      // @ts-expect-error - Testing server-side environment
      global.window = undefined;
      const adapter = new ContextStorageAdapter();
      expect(adapter.isEnabled()).toBe(false);
      const testData: ContextData = { utm: { utm_source: "google" } };
      adapter.set(testData);
      expect(adapter.get()).toBeNull();
      global.window = originalWindow;
    });
  });
});
