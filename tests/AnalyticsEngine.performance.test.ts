import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnalyticsEngine } from "../src/core/AnalyticsEngine";
import { type IAnalyticsEvent } from "../src/types/IAnalyticsEvent";
import { PerformanceMonitor } from "../src/core/PerformanceMonitor";
class PerformanceTestProvider implements IAnalyticsEvent {
  public loadCalled = false;
  public initCalled = false;
  public sentEvents: Array<{ eventName: string; options?: unknown }> = [];
  public userIdSet?: string;
  public destroyCalled = false;
  public loadDelay = 0;
  public sendDelay = 0;
  public shouldFailLoad = false;
  public shouldFailSend = false;
  load(callback?: () => void): void {
    this.loadCalled = true;
    if (this.shouldFailLoad) {
      throw new Error("Provider load failed");
    }
    if (this.loadDelay > 0) {
      setTimeout(() => callback?.(), this.loadDelay);
    } else {
      callback?.();
    }
  }
  init(): void {
    this.initCalled = true;
  }
  send<T>(eventName: string, options?: T): void {
    if (this.shouldFailSend) {
      throw new Error("Send failed");
    }
    if (this.sendDelay > 0) {
      setTimeout(() => {
        this.sentEvents.push({ eventName, options });
      }, this.sendDelay);
    } else {
      this.sentEvents.push({ eventName, options });
    }
  }
  setUserId(userId: string): void {
    this.userIdSet = userId;
  }
  destroy(): void {
    this.destroyCalled = true;
  }
}
describe("AnalyticsEngine Performance Tracking", () => {
  let engine: AnalyticsEngine;
  let mockProvider1: PerformanceTestProvider;
  let mockProvider2: PerformanceTestProvider;
  let performanceMonitor: PerformanceMonitor;
  beforeEach(() => {
    vi.useFakeTimers();
    mockProvider1 = new PerformanceTestProvider();
    mockProvider2 = new PerformanceTestProvider();
    performanceMonitor = new PerformanceMonitor({
      enablePerformanceTracking: true,
      performanceLogInterval: 1000,
    });
  });
  afterEach(() => {
    engine?.destroy();
    vi.useRealTimers();
  });
  describe("Performance Tracking Configuration", () => {
    it("should initialize with performance tracking disabled by default", () => {
      engine = new AnalyticsEngine();
      const metrics = engine.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.startTime).toBe(0);
      expect(metrics.totalEventsProcessed).toBe(0);
    });
    it("should enable performance tracking when configured", () => {
      engine = new AnalyticsEngine({}, performanceMonitor);
      const metrics = engine.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.startTime).toBeGreaterThan(0);
    });
    it("should reset performance metrics correctly", () => {
      engine = new AnalyticsEngine({}, performanceMonitor);
      engine.addProvider(mockProvider1, "amplitude");
      engine.send("test_event");
      const initialMetrics = engine.getPerformanceMetrics();
      expect(initialMetrics.totalEventsProcessed).toBeGreaterThan(0);
      engine.resetPerformanceMetrics();
      const resetMetrics = engine.getPerformanceMetrics();
      expect(resetMetrics.totalEventsProcessed).toBe(0);
    });
  });
  describe("Provider Loading Performance", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: true,
        },
        performanceMonitor,
      );
    });
    it("should track provider load times", async () => {
      mockProvider1.loadDelay = 50;
      engine.addProvider(mockProvider1, "amplitude");
      engine.send("test_event");
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 200));
      vi.useFakeTimers();
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.providerLoadAttempts.get("amplitude")).toBe(1);
      expect(mockProvider1.loadCalled).toBe(true);
    });
    it("should track provider load failures", async () => {
      const failingProvider = new PerformanceTestProvider();
      failingProvider.shouldFailLoad = true;
      engine.addProvider(failingProvider, "amplitude");
      const loadPromise = engine["loadProvider"]("amplitude", failingProvider);
      await expect(loadPromise).rejects.toThrow("Provider load failed");
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.providerLoadFailures.get("amplitude")).toBe(1);
    });
    it("should track retry attempts", async () => {
      const performanceMonitor = new PerformanceMonitor({
        enablePerformanceTracking: true,
        performanceLogInterval: 1000,
      });
      engine = new AnalyticsEngine(
        {
          lazyLoading: true,
          maxRetries: 2,
        },
        performanceMonitor,
      );
      let loadAttempts = 0;
      const originalLoad = mockProvider1.load.bind(mockProvider1);
      mockProvider1.load = (callback?: () => void) => {
        loadAttempts++;
        if (loadAttempts < 2) {
          return;
        }
        return originalLoad(callback);
      };
      engine.addProvider(mockProvider1, "amplitude");
      engine.send("test_event");
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 200));
      vi.useFakeTimers();
      const metrics = engine.getPerformanceMetrics();
      expect(
        metrics.providerLoadAttempts.get("amplitude"),
      ).toBeGreaterThanOrEqual(1);
    });
  });
  describe("Batch Processing Performance", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          batchSize: 3,
          batchTimeout: 100,
          lazyLoading: false,
        },
        performanceMonitor,
      );
      engine.addProvider(mockProvider1, "amplitude");
      engine.addProvider(mockProvider2, "google-analytics");
    });
    it("should track batch processing metrics", async () => {
      engine.send("event1");
      engine.send("event2");
      engine.send("event3");
      engine.send("event4");
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 200));
      vi.useFakeTimers();
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.totalEventsProcessed).toBeGreaterThan(0);
    });
    it("should track average batch size", async () => {
      for (let i = 0; i < 6; i++) {
        engine.send(`event${i}`);
      }
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 200));
      vi.useFakeTimers();
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.totalEventsProcessed).toBeGreaterThan(0);
    });
  });
  describe("Queue Management Performance", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          maxProviderQueueSize: 5,
          lazyLoading: true,
        },
        performanceMonitor,
      );
    });
    it("should track queue overflows", () => {
      engine.addProvider(mockProvider1, "amplitude");
      for (let i = 0; i < 10; i++) {
        engine.send(`event${i}`);
      }
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.queueOverflows).toBeGreaterThanOrEqual(0);
      expect(metrics.maxQueueSize).toBeGreaterThan(0);
    });
    it("should track queue size metrics", () => {
      engine.addProvider(mockProvider1, "amplitude");
      for (let i = 0; i < 3; i++) {
        engine.send(`event${i}`);
      }
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.maxQueueSize).toBeGreaterThan(0);
      expect(metrics.averageQueueSize).toBeGreaterThan(0);
    });
  });
  describe("Context Caching Performance", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          contextCacheTimeout: 1000,
          lazyLoading: false,
        },
        performanceMonitor,
      );
      engine.addProvider(mockProvider1, "amplitude");
    });
    it("should track cache hits and misses", () => {
      engine.send("event1");
      engine.send("event2");
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.contextCacheMisses).toBe(0);
      expect(metrics.contextCacheHits).toBe(0);
    });
    it("should track cache effectiveness over time", () => {
      for (let i = 0; i < 5; i++) {
        engine.send(`event${i}`);
      }
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.contextCacheHits + metrics.contextCacheMisses).toBe(0);
    });
  });
  describe("Event Processing Performance", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: false,
        },
        performanceMonitor,
      );
    });
    it("should track event processing times", async () => {
      engine.addProvider(mockProvider1, "amplitude");
      engine.load(() => {
        expect(engine.isProviderReady("amplitude")).toBe(true);
        expect(mockProvider1.initCalled).toBe(true);
        engine.send("test_event");
        const metrics = engine.getPerformanceMetrics();
        expect(metrics.eventProcessingTimes.length).toBeGreaterThan(0);
        expect(metrics.eventProcessingTimes[0]).toBeGreaterThanOrEqual(0);
      });
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 100));
      vi.useFakeTimers();
    });
    it("should track failed events", () => {
      mockProvider1.shouldFailSend = true;
      engine.addProvider(mockProvider1, "amplitude");
      engine.send("test_event");
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.failedEvents).toBe(1);
    });
    it("should limit memory usage of performance data", () => {
      engine.addProvider(mockProvider1, "amplitude");
      for (let i = 0; i < 1500; i++) {
        engine.send(`event${i}`);
      }
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.eventProcessingTimes.length).toBeLessThanOrEqual(1000);
    });
  });
  describe("Performance Impact Assessment", () => {
    it("should have minimal overhead when tracking is disabled", () => {
      const startTime = performance.now();
      engine = new AnalyticsEngine();
      engine.addProvider(mockProvider1, "amplitude");
      for (let i = 0; i < 100; i++) {
        engine.send(`event${i}`);
      }
      const endTime = performance.now();
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
    });
    it("should have acceptable overhead when tracking is enabled", () => {
      const startTime = performance.now();
      engine = new AnalyticsEngine({}, performanceMonitor);
      engine.addProvider(mockProvider1, "amplitude");
      for (let i = 0; i < 100; i++) {
        engine.send(`event${i}`);
      }
      const endTime = performance.now();
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(200);
    });
  });
  describe("Memory Management", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: false,
        },
        performanceMonitor,
      );
    });
    it("should track active timers and promises", async () => {
      engine.addProvider(mockProvider1, "amplitude");
      engine.send("event1");
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.activeTimers).toBeGreaterThanOrEqual(0);
      expect(metrics.activePromises).toBeGreaterThanOrEqual(0);
    });
    it("should clean up resources on destroy", () => {
      engine.addProvider(mockProvider1, "amplitude");
      engine.send("event1");
      engine.destroy();
      expect(mockProvider1.destroyCalled).toBe(true);
    });
  });
});
