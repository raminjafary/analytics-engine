import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BaseAnalyticsAdapter } from "../src/adapters/BaseAnalyticsAdapter";
import { BaseContextProvider } from "../src/providers/BaseContextProvider";
import { BaseStorageAdapter } from "../src/storage/BaseStorageAdapter";
import { BrowserContextProvider } from "../src/providers/BrowserContextProvider";
import { BrowserStorageAdapter } from "../src/storage/BrowserStorageAdapter";
import type {
  IAnalyticsEvent,
  IContextProvider,
  IStorageAdapter,
  IAnalyticsLogger,
} from "../src/types/IAnalyticsEvent";
class MockLogger implements IAnalyticsLogger {
  public logs: Array<{ level: string; message: string; data?: unknown }> = [];
  debug(message: string, data?: unknown): void {
    this.logs.push({ level: "debug", message, data });
  }
  info(message: string, data?: unknown): void {
    this.logs.push({ level: "info", message, data });
  }
  warn(message: string, data?: unknown): void {
    this.logs.push({ level: "warn", message, data });
  }
  error(message: string, data?: unknown): void {
    this.logs.push({ level: "error", message, data });
  }
}
class TestAnalyticsAdapter
  extends BaseAnalyticsAdapter
  implements IAnalyticsEvent
{
  public events: Array<{ eventName: string; options?: unknown }> = [];
  public isLoaded = false;
  public isInitialized = false;
  async load(callback?: () => void): Promise<void> {
    this.isLoaded = true;
    callback?.();
  }
  init(): void {
    this.isInitialized = true;
  }
  send<T>(eventName: string, options?: T): void {
    this.events.push({ eventName, options });
  }
  setUserId(_userId: string): void {}
  public testLogError(operation: string, error: Error): void {
    this.logError(operation, error);
  }
  public testLogInfo(message: string, data?: unknown): void {
    this.logInfo(message, data);
  }
}
class TestContextProvider
  extends BaseContextProvider
  implements IContextProvider
{
  public utmParams: Record<string, string> = {};
  getUTMParameters() {
    return this.utmParams;
  }
  getCurrentUrl(): string {
    return "https://example.com/page";
  }
  getReferrer(): string {
    return "https://google.com";
  }
  protected cacheAllContextData(): void {}
  public testCacheUTM(utm: Record<string, string>): void {
    this.cacheUTM(utm);
  }
  public testGetCachedUTM(): unknown {
    return this.getCachedUTM();
  }
}
class TestStorageAdapter extends BaseStorageAdapter implements IStorageAdapter {
  private storage = new Map<string, unknown>();
  constructor(enabled: boolean = true, logger?: IAnalyticsLogger) {
    super(enabled, logger);
  }
  set(key: string, data: unknown): void {
    this.storage.set(key, data);
  }
  get(key: string): unknown | null {
    return this.storage.get(key) || null;
  }
  remove(key: string): void {
    this.storage.delete(key);
  }
  clear(): void {
    this.storage.clear();
  }
  public testLogError(operation: string, error: Error): void {
    this.logError(operation, error);
  }
  public testSetEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
describe("Base Classes", () => {
  let mockLogger: MockLogger;
  let originalWindow: (Window & typeof globalThis) | undefined;
  let originalDocument: Document | undefined;
  beforeEach(() => {
    originalWindow = global.window;
    originalDocument = global.document;
    global.window = {
      location: {
        href: "https://example.com/page?utm_source=google",
        search: "?utm_source=google",
      },
    } as unknown as Window & typeof globalThis;
    global.document = {
      referrer: "https://google.com",
    } as unknown as Document;
    mockLogger = new MockLogger();
  });
  afterEach(() => {
    if (originalWindow) {
      global.window = originalWindow;
    } else {
      delete (global as { window?: Window & typeof globalThis }).window;
    }
    if (originalDocument) {
      global.document = originalDocument;
    } else {
      delete (global as { document?: Document }).document;
    }
  });
  describe("BaseAnalyticsAdapter", () => {
    it("should create adapter with logger", () => {
      const adapter = new TestAnalyticsAdapter(mockLogger);
      expect(adapter).toBeDefined();
    });
    it("should handle destroy method", () => {
      const adapter = new TestAnalyticsAdapter(mockLogger);
      adapter.destroy?.();
      expect(adapter.isLoaded).toBe(false);
      expect(adapter.isInitialized).toBe(false);
    });
    it("should log errors appropriately", () => {
      const adapter = new TestAnalyticsAdapter(mockLogger);
      adapter.testLogError("test operation", new Error("Test error"));
      const errorLogs = mockLogger.logs.filter((log) => log.level === "error");
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toContain("test operation");
    });
    it("should log info messages", () => {
      const adapter = new TestAnalyticsAdapter(mockLogger);
      adapter.testLogInfo("test message", { data: "test" });
      const infoLogs = mockLogger.logs.filter((log) => log.level === "info");
      expect(infoLogs).toHaveLength(1);
      expect(infoLogs[0].message).toBe("test message");
    });
  });
  describe("BaseContextProvider", () => {
    it("should create context provider with storage adapter", () => {
      const storageAdapter = new TestStorageAdapter();
      const provider = new TestContextProvider(storageAdapter, mockLogger);
      expect(provider).toBeDefined();
    });
    it("should handle storage operations", () => {
      const storageAdapter = new TestStorageAdapter();
      const provider = new TestContextProvider(storageAdapter, mockLogger);
      provider.testCacheUTM({ utm_source: "google" });
      const cached = provider.testGetCachedUTM();
      expect(cached).toEqual({ utm_source: "google" });
    });
    it("should clear cache", () => {
      const storageAdapter = new TestStorageAdapter();
      const provider = new TestContextProvider(storageAdapter, mockLogger);
      provider.testCacheUTM({ utm_source: "google" });
      provider.clearCache();
      const cached = provider.testGetCachedUTM();
      expect(cached).toBeNull();
    });
    it("should check if storage is enabled", () => {
      const storageAdapter = new TestStorageAdapter();
      const provider = new TestContextProvider(storageAdapter, mockLogger);
      expect(provider.isStorageEnabled()).toBe(true);
    });
  });
  describe("BaseStorageAdapter", () => {
    it("should create storage adapter with enabled state", () => {
      const adapter = new TestStorageAdapter();
      expect(adapter.isEnabled()).toBe(true);
    });
    it("should create disabled storage adapter", () => {
      const adapter = new TestStorageAdapter();
      adapter.testSetEnabled(false);
      expect(adapter.isEnabled()).toBe(false);
    });
    it("should log errors appropriately", () => {
      const adapter = new TestStorageAdapter(true, mockLogger);
      adapter.testLogError("test operation", new Error("Test error"));
      const errorLogs = mockLogger.logs.filter((log) => log.level === "error");
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toContain("test operation");
    });
  });
  describe("BrowserContextProvider", () => {
    it("should extract UTM parameters from URL", () => {
      const provider = BrowserContextProvider.getInstance();
      const utm = provider.getUTMParameters();
      expect(utm.utm_source).toBe("google");
    });
    it("should get current URL", () => {
      const provider = BrowserContextProvider.getInstance();
      const url = provider.getCurrentUrl();
      expect(url).toBe("https://example.com/page?utm_source=google");
    });
    it("should get referrer", () => {
      const provider = BrowserContextProvider.getInstance();
      const referrer = provider.getReferrer();
      expect(referrer).toBe("https://google.com");
    });
    it("should handle singleton pattern", () => {
      const provider1 = BrowserContextProvider.getInstance();
      const provider2 = BrowserContextProvider.getInstance();
      expect(provider1).toBe(provider2);
    });
    it("should reset singleton instance", () => {
      const provider1 = BrowserContextProvider.getInstance();
      BrowserContextProvider.resetInstance();
      const provider2 = BrowserContextProvider.getInstance();
      expect(provider1).not.toBe(provider2);
    });
  });
  describe("BrowserStorageAdapter", () => {
    it("should create browser storage adapter", () => {
      const adapter = new BrowserStorageAdapter({
        storageType: "sessionStorage",
        enabled: true,
      });
      expect(adapter).toBeDefined();
      expect(adapter.isEnabled()).toBe(true);
    });
    it("should handle localStorage", () => {
      const adapter = new BrowserStorageAdapter({
        storageType: "localStorage",
        enabled: true,
      });
      expect(adapter).toBeDefined();
    });
    it("should handle disabled state", () => {
      const adapter = new BrowserStorageAdapter({
        storageType: "sessionStorage",
        enabled: false,
      });
      expect(adapter.isEnabled()).toBe(false);
    });
    it("should handle storage operations", () => {
      const mockStorage = new Map<string, string>();
      Object.defineProperty(global.window, "sessionStorage", {
        value: {
          getItem: (key: string) => mockStorage.get(key) || null,
          setItem: (key: string, value: string) => mockStorage.set(key, value),
          removeItem: (key: string) => mockStorage.delete(key),
          clear: () => mockStorage.clear(),
        },
        writable: true,
      });
      const adapter = new BrowserStorageAdapter({
        storageType: "sessionStorage",
        enabled: true,
      });
      adapter.set("test-key", { data: "test" });
      const retrieved = adapter.get("test-key");
      expect(retrieved).toEqual({ data: "test" });
      adapter.remove("test-key");
      const afterRemoval = adapter.get("test-key");
      expect(afterRemoval).toBeNull();
    });
  });
});
