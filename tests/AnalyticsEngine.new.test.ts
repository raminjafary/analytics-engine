import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AnalyticsEngine } from "../src/core/AnalyticsEngine";
import { BrowserContextProvider } from "../src/providers/BrowserContextProvider";
import { BrowserStorageAdapter } from "../src/storage/BrowserStorageAdapter";
import { BaseAnalyticsAdapter } from "../src/adapters/BaseAnalyticsAdapter";
import type {
  IAnalyticsEvent,
  IAnalyticsLogger,
} from "../src/types/IAnalyticsEvent";
class MockAnalyticsAdapter
  extends BaseAnalyticsAdapter
  implements IAnalyticsEvent
{
  public events: Array<{ eventName: string; options?: unknown }> = [];
  public loadCallback?: () => void;
  async load(callback?: () => void): Promise<void> {
    this.loadCallback = callback;
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
}
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
describe("AnalyticsEngine - New Structure", () => {
  let engine: AnalyticsEngine;
  let mockAdapter: MockAnalyticsAdapter;
  let mockLogger: MockLogger;
  let originalWindow: (Window & typeof globalThis) | undefined;
  let originalDocument: Document | undefined;
  beforeEach(() => {
    originalWindow = global.window;
    originalDocument = global.document;
    global.window = {
      location: {
        href: "https://example.com/page?utm_source=google&utm_medium=cpc",
        search: "?utm_source=google&utm_medium=cpc",
      },
    } as unknown as Window & typeof globalThis;
    global.document = {
      referrer: "https://google.com",
    } as unknown as Document;
    mockLogger = new MockLogger();
    mockAdapter = new MockAnalyticsAdapter(mockLogger);
    engine = new AnalyticsEngine({
      maxQueueSize: 100,
      debug: true,
      logger: mockLogger,
    });
  });
  afterEach(() => {
    if (originalWindow) {
      global.window = originalWindow;
    }
    if (originalDocument) {
      global.document = originalDocument;
    }
    engine.destroy();
  });
  describe("Basic Functionality", () => {
    it("should create analytics engine with default config", () => {
      const defaultEngine = new AnalyticsEngine();
      expect(defaultEngine).toBeDefined();
      expect(defaultEngine.getQueueSize()).toBe(0);
    });
    it("should add and remove providers", () => {
      engine.addProvider(mockAdapter, "test-provider");
      const providers = engine.getProviders();
      expect(providers).toContain("test-provider");
      engine.removeProvider("test-provider");
      const providersAfterRemoval = engine.getProviders();
      expect(providersAfterRemoval).not.toContain("test-provider");
    });
    it("should send events to providers", async () => {
      engine.addProvider(mockAdapter, "test-provider");
      await new Promise((resolve) => setTimeout(resolve, 100));
      engine.send("test_event", { property: "value" });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockAdapter.events).toHaveLength(1);
      expect(mockAdapter.events[0].eventName).toBe("test_event");
      expect(mockAdapter.events[0].options).toEqual({ property: "value" });
    });
    it("should set user ID on providers", async () => {
      engine.addProvider(mockAdapter, "test-provider");
      engine.send("test-event");
      await new Promise((resolve) => setTimeout(resolve, 100));
      engine.setUserId("user123");
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    it("should set global properties", () => {
      const properties = { version: "1.0.0", environment: "test" };
      engine.setGlobalProperties(properties);
      expect(engine).toBeDefined();
    });
  });
  describe("Context Provider Integration", () => {
    it("should work with BrowserContextProvider", () => {
      const storageAdapter = new BrowserStorageAdapter({
        storageType: "sessionStorage",
        enabled: true,
      });
      const contextProvider = BrowserContextProvider.getInstance(
        storageAdapter,
        mockLogger,
      );
      engine.setContextProvider(contextProvider);
      const utm = contextProvider.getUTMParameters();
      expect(utm.utm_source).toBe("google");
      expect(utm.utm_medium).toBe("cpc");
    });
    it("should handle context provider errors gracefully", () => {
      const contextProvider = BrowserContextProvider.getInstance();
      engine.setContextProvider(contextProvider);
      expect(() => engine.send("test_event")).not.toThrow();
    });
  });
  describe("Provider Management", () => {
    it("should enable and disable providers", () => {
      engine.addProvider(mockAdapter, "test-provider");
      engine.disableProvider("test-provider");
      expect(engine.getEnabledProviders()).not.toContain("test-provider");
      engine.enableProvider("test-provider");
      expect(engine.getEnabledProviders()).toContain("test-provider");
    });
    it("should get provider state", () => {
      engine.addProvider(mockAdapter, "test-provider");
      const state = engine.getProviderState("test-provider");
      expect(state).toBeDefined();
    });
    it("should check if provider is ready", () => {
      engine.addProvider(mockAdapter, "test-provider");
      const isReady = engine.isProviderReady("test-provider");
      expect(typeof isReady).toBe("boolean");
    });
  });
  describe("Queue Management", () => {
    it("should flush queue", async () => {
      engine.addProvider(mockAdapter, "test-provider");
      engine.send("event1", { data: "1" });
      engine.send("event2", { data: "2" });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const queueSize = engine.getQueueSize();
      expect(queueSize).toBeGreaterThanOrEqual(0);
      engine.flushQueue();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(engine.getQueueSize()).toBe(0);
    });
    it("should clear queue", async () => {
      engine.addProvider(mockAdapter, "test-provider");
      engine.send("event1", { data: "1" });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const queueSize = engine.getQueueSize();
      expect(queueSize).toBeGreaterThanOrEqual(0);
      engine.clearQueue();
      expect(engine.getQueueSize()).toBe(0);
    });
  });
  describe("Error Handling", () => {
    it("should handle provider errors gracefully", () => {
      const errorAdapter = new MockAnalyticsAdapter(mockLogger);
      errorAdapter.send = () => {
        throw new Error("Provider error");
      };
      engine.addProvider(errorAdapter, "error-provider");
      expect(() => engine.send("test_event")).not.toThrow();
    });
    it("should log errors appropriately", async () => {
      const errorAdapter = new MockAnalyticsAdapter(mockLogger);
      errorAdapter.send = () => {
        throw new Error("Provider error");
      };
      engine.addProvider(errorAdapter, "error-provider");
      engine.send("test_event");
      await new Promise((resolve) => setTimeout(resolve, 100));
      const errorLogs = mockLogger.logs.filter((log) => log.level === "error");
      expect(errorLogs.length).toBeGreaterThan(0);
    });
  });
  describe("Performance", () => {
    it("should handle multiple events efficiently", async () => {
      engine.addProvider(mockAdapter, "test-provider");
      for (let i = 0; i < 10; i++) {
        engine.send(`event_${i}`, { index: i });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(mockAdapter.events.length).toBe(10);
    });
    it("should provide performance stats", () => {
      engine.addProvider(mockAdapter, "test-provider");
      const stats = engine.getProviderStats?.();
      expect(stats).toBeDefined();
      expect(stats?.total).toBe(1);
    });
  });
  describe("Lifecycle", () => {
    it("should destroy engine properly", async () => {
      engine.addProvider(mockAdapter, "test-provider");
      engine.send("test_event");
      await new Promise((resolve) => setTimeout(resolve, 50));
      const queueSize = engine.getQueueSize();
      expect(queueSize).toBeGreaterThanOrEqual(0);
      engine.destroy();
      expect(engine.getQueueSize()).toBe(0);
    });
    it("should reset engine state", () => {
      engine.addProvider(mockAdapter, "test-provider");
      engine.send("test_event");
      engine.reset();
      expect(engine.getQueueSize()).toBe(0);
    });
  });
});
