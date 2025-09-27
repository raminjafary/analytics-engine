import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnalyticsEngine } from "../src/core/AnalyticsEngine";
import {
  ProviderState,
  type IAnalyticsEvent,
} from "../src/types/IAnalyticsEvent";
class MockAnalyticsProvider implements IAnalyticsEvent {
  public loadCallback?: () => void;
  public loadCalled = false;
  public initCalled = false;
  public sentEvents: Array<{ eventName: string; options?: unknown }> = [];
  public userIdSet?: string;
  public destroyCalled = false;
  public shouldFailLoad = false;
  load(callback?: () => void): void {
    this.loadCalled = true;
    this.loadCallback = callback;
    if (this.shouldFailLoad) {
      throw new Error("Load failed");
    }
    vi.useRealTimers();
    setTimeout(() => {
      callback?.();
      vi.useFakeTimers();
    }, 10);
  }
  init(): void {
    this.initCalled = true;
  }
  send<T>(eventName: string, options?: T): void {
    this.sentEvents.push({ eventName, options });
  }
  setUserId(userId: string): void {
    this.userIdSet = userId;
  }
  destroy(): void {
    this.destroyCalled = true;
  }
  triggerLoadCallback(): void {
    this.loadCallback?.();
  }
}
describe("AnalyticsEngine", () => {
  let engine: AnalyticsEngine;
  let mockProvider1: MockAnalyticsProvider;
  let mockProvider2: MockAnalyticsProvider;
  beforeEach(() => {
    vi.useFakeTimers();
    engine = new AnalyticsEngine();
    mockProvider1 = new MockAnalyticsProvider();
    mockProvider2 = new MockAnalyticsProvider();
    mockProvider1.shouldFailLoad = false;
    mockProvider2.shouldFailLoad = false;
  });
  afterEach(() => {
    engine.destroy();
    vi.useRealTimers();
  });
  describe("Provider Management", () => {
    it("should add providers correctly", () => {
      engine.addProvider(mockProvider1, "amplitude");
      engine.addProvider(mockProvider2, "google-analytics");
      const providers = engine.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers).toContain("amplitude");
      expect(providers).toContain("google-analytics");
    });
    it("should remove providers correctly", () => {
      engine.addProvider(mockProvider1, "amplitude");
      engine.addProvider(mockProvider2, "google-analytics");
      engine.removeProvider("amplitude");
      const providers = engine.getProviders();
      expect(providers).toHaveLength(1);
      expect(providers).toContain("google-analytics");
      expect(mockProvider1.destroyCalled).toBe(true);
    });
    it("should track provider states correctly", () => {
      engine.addProvider(mockProvider1, "amplitude");
      expect(engine.getProviderState("amplitude")).toBe(
        ProviderState.UNINITIALIZED,
      );
      expect(engine.isProviderReady("amplitude")).toBe(false);
      expect(engine.getReadyProviders()).toHaveLength(0);
    });
  });
  describe("Lazy Loading Mode", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine({ lazyLoading: true });
    });
    it("should not load providers immediately when added", () => {
      engine.addProvider(mockProvider1, "amplitude");
      expect(mockProvider1.loadCalled).toBe(false);
      expect(engine.getProviderState("amplitude")).toBe(
        ProviderState.UNINITIALIZED,
      );
    });
    it("should load providers when events are sent", async () => {
      engine.addProvider(mockProvider1, "amplitude");
      engine.send("test_event", { data: "test" });
      expect(mockProvider1.loadCalled).toBe(true);
      expect(engine.getProviderState("amplitude")).toBe(ProviderState.LOADING);
    });
    it("should queue events until providers are ready", async () => {
      engine.addProvider(mockProvider1, "amplitude");
      engine.send("test_event", { data: "test" });
      expect(mockProvider1.sentEvents).toHaveLength(0);
      expect(engine.getQueueSize()).toBeGreaterThan(0);
      mockProvider1.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockProvider1.sentEvents).toHaveLength(1);
      expect(mockProvider1.sentEvents[0].eventName).toBe("test_event");
      vi.useFakeTimers();
    });
  });
  describe("Event Sending", () => {
    beforeEach(async () => {
      engine = new AnalyticsEngine({ lazyLoading: false });
      engine.addProvider(mockProvider1, "amplitude");
      engine.addProvider(mockProvider2, "google-analytics");
      mockProvider1.triggerLoadCallback();
      mockProvider2.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();
    });
    it("should send events to all enabled providers", () => {
      engine.send("test_event", { data: "test" });
      expect(mockProvider1.sentEvents).toHaveLength(1);
      expect(mockProvider2.sentEvents).toHaveLength(1);
      expect(mockProvider1.sentEvents[0].eventName).toBe("test_event");
      expect(mockProvider2.sentEvents[0].eventName).toBe("test_event");
    });
    it("should send events to specific providers", () => {
      engine.sendToProviders("test_event", ["amplitude"], {
        data: "test",
      });
      expect(mockProvider1.sentEvents).toHaveLength(1);
      expect(mockProvider2.sentEvents).toHaveLength(0);
    });
  });
  describe("Performance Monitor Safety", () => {
    it("should work safely without performance monitor (null)", () => {
      expect(() => {
        engine = new AnalyticsEngine({}, null);
      }).not.toThrow();
      expect(engine).toBeDefined();
      expect(engine.getProviders()).toEqual([]);
      const metrics = engine.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.startTime).toBe(0);
      expect(metrics.totalEventsProcessed).toBe(0);
    });
    it("should work safely without performance monitor (undefined)", () => {
      expect(() => {
        engine = new AnalyticsEngine({}, undefined);
      }).not.toThrow();
      expect(engine).toBeDefined();
      expect(engine.getProviders()).toEqual([]);
    });
    it("should work safely with no performance monitor parameter", () => {
      expect(() => {
        engine = new AnalyticsEngine();
      }).not.toThrow();
      expect(engine).toBeDefined();
      expect(engine.getProviders()).toEqual([]);
    });
    it("should handle full lifecycle without performance monitor", async () => {
      engine = new AnalyticsEngine({ lazyLoading: false });
      expect(() => {
        engine.addProvider(mockProvider1, "amplitude");
      }).not.toThrow();
      expect(() => {
        engine.load();
      }).not.toThrow();
      expect(() => {
        engine.init();
      }).not.toThrow();
      expect(() => {
        engine.setGlobalProperties({ testProp: "value" });
      }).not.toThrow();
      expect(() => {
        engine.setUserId("test-user-123");
      }).not.toThrow();
      expect(() => {
        engine.send("test_event", { data: "test" });
      }).not.toThrow();
      expect(() => {
        engine.sendToProviders("targeted_event", ["amplitude"]);
      }).not.toThrow();
      expect(() => {
        const queueSize = engine.getQueueSize();
        expect(typeof queueSize).toBe("number");
      }).not.toThrow();
      expect(() => {
        engine.flushQueue();
      }).not.toThrow();
      expect(() => {
        engine.clearQueue();
      }).not.toThrow();
      expect(() => {
        const metrics = engine.getPerformanceMetrics();
        expect(metrics).toBeDefined();
      }).not.toThrow();
      expect(() => {
        engine.resetPerformanceMetrics();
      }).not.toThrow();
      expect(() => {
        engine.logPerformanceMetrics();
      }).not.toThrow();
      expect(() => {
        const providers = engine.getProviders();
        expect(Array.isArray(providers)).toBe(true);
      }).not.toThrow();
      expect(() => {
        const enabledProviders = engine.getEnabledProviders();
        expect(Array.isArray(enabledProviders)).toBe(true);
      }).not.toThrow();
      expect(() => {
        const readyProviders = engine.getReadyProviders();
        expect(Array.isArray(readyProviders)).toBe(true);
      }).not.toThrow();
      expect(() => {
        engine.reset();
      }).not.toThrow();
      expect(() => {
        engine.destroy();
      }).not.toThrow();
    });
    it("should handle errors gracefully without performance monitor", () => {
      engine = new AnalyticsEngine();
      mockProvider1.shouldFailLoad = true;
      expect(() => {
        engine.addProvider(mockProvider1, "amplitude");
      }).not.toThrow();
      expect(() => {
        engine.load();
      }).not.toThrow();
      expect(() => {
        engine.send("test_event");
      }).not.toThrow();
      expect(() => {
        const metrics = engine.getPerformanceMetrics();
        expect(metrics).toBeDefined();
      }).not.toThrow();
    });
    it("should handle high load without performance monitor", () => {
      engine = new AnalyticsEngine({
        maxQueueSize: 100,
        lazyLoading: true,
      });
      engine.addProvider(mockProvider1, "amplitude");
      expect(() => {
        for (let i = 0; i < 150; i++) {
          engine.send(`event_${i}`, { index: i });
        }
      }).not.toThrow();
      expect(() => {
        const queueSize = engine.getQueueSize();
        expect(typeof queueSize).toBe("number");
      }).not.toThrow();
      expect(() => {
        engine.flushQueue();
      }).not.toThrow();
    });
  });
  describe("Configuration", () => {
    it("should use custom configuration", () => {
      const customConfig = {
        maxQueueSize: 500,
        maxRetries: 5,
        lazyLoading: false,
      };
      engine = new AnalyticsEngine(customConfig);
      const stats = engine.getProviderStats();
      expect(stats.isLazyLoading).toBe(false);
    });
  });
  describe("Provider Stats", () => {
    it("should return accurate provider stats", async () => {
      engine.addProvider(mockProvider1, "amplitude");
      engine.addProvider(mockProvider2, "google-analytics");
      let stats = engine.getProviderStats();
      expect(stats.total).toBe(2);
      expect(stats.uninitialized).toBe(2);
      expect(stats.ready).toBe(0);
      engine.send("test_event", { data: "test" });
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      stats = engine.getProviderStats();
      expect(stats.ready).toBeGreaterThanOrEqual(1);
      vi.useFakeTimers();
    });
  });
  describe("loadSelectedProviders", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine({ lazyLoading: true });
      engine.addProvider(mockProvider1, "amplitude");
      engine.addProvider(mockProvider2, "google-analytics");
    });
    it("should load providers by name", async () => {
      const loadPromise = engine.loadSelectedProviders(["amplitude"]);
      expect(mockProvider1.loadCalled).toBe(true);
      expect(mockProvider2.loadCalled).toBe(false);
      mockProvider1.triggerLoadCallback();
      await loadPromise;
      expect(engine.getProviderState("amplitude")).toBe(ProviderState.READY);
      expect(engine.getProviderState("google-analytics")).toBe(
        ProviderState.UNINITIALIZED,
      );
    });
    it("should load providers by type", async () => {
      const loadPromise = engine.loadSelectedProviders(["google-analytics"]);
      expect(mockProvider2.loadCalled).toBe(true);
      expect(mockProvider1.loadCalled).toBe(false);
      mockProvider2.triggerLoadCallback();
      await loadPromise;
      expect(engine.getProviderState("google-analytics")).toBe(
        ProviderState.READY,
      );
      expect(engine.getProviderState("amplitude")).toBe(
        ProviderState.UNINITIALIZED,
      );
    });
    it("should load multiple providers simultaneously", async () => {
      const loadPromise = engine.loadSelectedProviders([
        "amplitude",
        "google-analytics",
      ]);
      expect(mockProvider1.loadCalled).toBe(true);
      expect(mockProvider2.loadCalled).toBe(true);
      mockProvider1.triggerLoadCallback();
      mockProvider2.triggerLoadCallback();
      await loadPromise;
      expect(engine.getProviderState("amplitude")).toBe(ProviderState.READY);
      expect(engine.getProviderState("google-analytics")).toBe(
        ProviderState.READY,
      );
    });
    it("should skip already loaded providers", async () => {
      const firstLoadPromise = engine.loadSelectedProviders(["amplitude"]);
      mockProvider1.triggerLoadCallback();
      await firstLoadPromise;
      mockProvider1.loadCalled = false;
      const secondLoadPromise = engine.loadSelectedProviders(["amplitude"]);
      expect(mockProvider1.loadCalled).toBe(false);
      await secondLoadPromise;
    });
    it("should handle non-existent providers gracefully", async () => {
      const loadPromise = engine.loadSelectedProviders([
        "non_existent_provider",
      ]);
      await loadPromise;
      expect(mockProvider1.loadCalled).toBe(false);
      expect(mockProvider2.loadCalled).toBe(false);
    });
    it("should handle mixed valid and invalid providers", async () => {
      const loadPromise = engine.loadSelectedProviders([
        "amplitude",
        "non_existent_provider",
      ]);
      expect(mockProvider1.loadCalled).toBe(true);
      expect(mockProvider2.loadCalled).toBe(false);
      mockProvider1.triggerLoadCallback();
      await loadPromise;
      expect(engine.getProviderState("amplitude")).toBe(ProviderState.READY);
    });
    it("should execute callback when loading completes", async () => {
      let callbackExecuted = false;
      const loadPromise = engine.loadSelectedProviders(["amplitude"], () => {
        callbackExecuted = true;
      });
      mockProvider1.triggerLoadCallback();
      await loadPromise;
      expect(callbackExecuted).toBe(true);
    });
    it("should handle provider load failures gracefully", async () => {
      mockProvider1.shouldFailLoad = true;
      const loadPromise = engine.loadSelectedProviders(["amplitude"]);
      await loadPromise;
      expect(engine.getProviderState("amplitude")).toBe(ProviderState.LOADING);
    });
    it("should flush queued events after loading", async () => {
      engine.send("queued_event_1", { data: "test1" });
      engine.send("queued_event_2", { data: "test2" });
      expect(mockProvider1.sentEvents).toHaveLength(0);
      const loadPromise = engine.loadSelectedProviders(["amplitude"]);
      mockProvider1.triggerLoadCallback();
      await loadPromise;
      expect(mockProvider1.sentEvents).toHaveLength(2);
    });
    it("should return early if engine is destroyed", async () => {
      engine.destroy();
      const loadPromise = engine.loadSelectedProviders(["amplitude"]);
      await loadPromise;
      expect(mockProvider1.loadCalled).toBe(false);
    });
  });
});
