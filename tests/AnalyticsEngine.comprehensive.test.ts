import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnalyticsEngine } from "../src/core/AnalyticsEngine";
import {
  ProviderState,
  type IAnalyticsEvent,
} from "../src/types/IAnalyticsEvent";
import { PerformanceMonitor } from "../src/core/PerformanceMonitor";
class ComprehensiveTestProvider implements IAnalyticsEvent {
  public id: string;
  public loadCallback?: () => void;
  public loadCalled = false;
  public initCalled = false;
  public sentEvents: Array<{
    eventName: string;
    options?: unknown;
    timestamp: number;
  }> = [];
  public userIdSet?: string;
  public destroyCalled = false;
  public shouldFailLoad = false;
  public shouldFailSend = false;
  public loadDelay = 0;
  public sendDelay = 0;
  public isReady = false;
  public loadCallCount = 0;
  public initCallCount = 0;
  constructor(id: string) {
    this.id = id;
  }
  load(callback?: () => void): void {
    this.loadCalled = true;
    this.loadCallCount++;
    this.loadCallback = callback;
    if (this.shouldFailLoad) {
      console.log(`Provider ${this.id} simulating load failure`);
      return;
    }
    if (this.loadDelay > 0) {
      setTimeout(() => {
        this.isReady = true;
        callback?.();
      }, this.loadDelay);
    } else {
    }
  }
  init(): void {
    this.initCalled = true;
    this.initCallCount++;
  }
  send<T>(eventName: string, options?: T): void {
    if (this.shouldFailSend) {
      throw new Error(`${this.id} send failed`);
    }
    const event = {
      eventName,
      options,
      timestamp: Date.now(),
    };
    if (this.sendDelay > 0) {
      setTimeout(() => {
        this.sentEvents.push(event);
      }, this.sendDelay);
    } else {
      this.sentEvents.push(event);
    }
  }
  setUserId(userId: string): void {
    this.userIdSet = userId;
  }
  destroy(): void {
    this.destroyCalled = true;
    this.isReady = false;
  }
  triggerLoadCallback(): void {
    this.isReady = true;
    this.loadCallback?.();
  }
  triggerLoadFailure(): void {
    this.shouldFailLoad = true;
    this.loadCallback?.();
  }
  getEventsOfType(
    eventName: string,
  ): Array<{ eventName: string; options?: unknown; timestamp: number }> {
    return this.sentEvents.filter((e) => e.eventName === eventName);
  }
  getTotalEventsSent(): number {
    return this.sentEvents.length;
  }
  clear(): void {
    this.sentEvents = [];
  }
  reset(): void {
    this.loadCalled = false;
    this.initCalled = false;
    this.sentEvents = [];
    this.userIdSet = undefined;
    this.destroyCalled = false;
    this.shouldFailLoad = false;
    this.shouldFailSend = false;
    this.isReady = false;
    this.loadCallCount = 0;
    this.initCallCount = 0;
  }
}
describe("AnalyticsEngine - Comprehensive Feature Tests", () => {
  let engine: AnalyticsEngine;
  let performanceMonitor: PerformanceMonitor;
  let provider1: ComprehensiveTestProvider;
  let provider2: ComprehensiveTestProvider;
  beforeEach(() => {
    vi.useFakeTimers();
    performanceMonitor = new PerformanceMonitor({
      enablePerformanceTracking: true,
      performanceLogInterval: 1000,
    });
    provider1 = new ComprehensiveTestProvider("provider1");
    provider2 = new ComprehensiveTestProvider("provider2");
    provider1.reset();
    provider2.reset();
  });
  afterEach(() => {
    engine?.destroy();
    vi.useRealTimers();
  });
  describe("🔄 Lazy Loading with Event Queuing", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: true,
          maxQueueSize: 1000,
          maxProviderQueueSize: 500,
          batchSize: 10,
          batchTimeout: 2000,
          enableSmartDequeue: true,
          maxSentEventsToKeep: 50,
        },
        performanceMonitor,
      );
    });
    it("should queue events before providers are loaded", () => {
      engine.addProvider(provider1, "amplitude");
      engine.addProvider(provider2, "google-analytics");
      expect(provider1.loadCalled).toBe(false);
      expect(provider2.loadCalled).toBe(false);
      engine.send("test_event_1", { data: "test1" });
      engine.send("test_event_2", { data: "test2" });
      engine.send("test_event_3", { data: "test3" });
      expect(provider1.loadCalled).toBe(true);
      expect(provider2.loadCalled).toBe(true);
      expect(engine.getProviderState("amplitude")).toBe(ProviderState.LOADING);
      expect(provider1.sentEvents).toHaveLength(0);
      expect(provider2.sentEvents).toHaveLength(0);
      expect(engine.getQueueSize()).toBeGreaterThan(0);
    });
    it("should send queued events after providers become ready", async () => {
      engine.addProvider(provider1, "amplitude");
      engine.addProvider(provider2, "google-analytics");
      engine.send("queued_1", { index: 1 });
      engine.send("queued_2", { index: 2 });
      engine.send("queued_3", { index: 3 });
      provider1.triggerLoadCallback();
      provider2.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 100));
      vi.useFakeTimers();
      expect(provider1.sentEvents).toHaveLength(3);
      expect(provider2.sentEvents).toHaveLength(3);
      expect(provider1.sentEvents.map((e) => e.eventName)).toEqual([
        "queued_1",
        "queued_2",
        "queued_3",
      ]);
    });
    it("should handle mixed ready/unready providers", async () => {
      engine.addProvider(provider1, "amplitude");
      engine.addProvider(provider2, "google-analytics");
      engine.send("mixed_test", { data: "test" });
      provider1.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();
      expect(provider1.sentEvents).toHaveLength(1);
      expect(provider2.sentEvents).toHaveLength(0);
      provider2.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();
      expect(provider2.sentEvents).toHaveLength(1);
    });
  });
  describe("📦 Batch Processing with Lazy Loading", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: true,
          batchSize: 5,
          batchTimeout: 1000,
          maxQueueSize: 100,
        },
        performanceMonitor,
      );
    });
    it("should batch process events after providers become ready", async () => {
      engine.addProvider(provider1, "amplitude");
      for (let i = 0; i < 12; i++) {
        engine.send(`batch_event_${i}`, { index: i });
      }
      expect(provider1.loadCalled).toBe(true);
      expect(provider1.sentEvents).toHaveLength(0);
      provider1.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 200));
      vi.useFakeTimers();
      expect(provider1.sentEvents).toHaveLength(12);
    });
    it("should handle batch processing with lazy loading correctly", async () => {
      engine.addProvider(provider1, "amplitude");
      for (let i = 0; i < 8; i++) {
        engine.send(`lazy_batch_${i}`, { index: i });
      }
      expect(provider1.loadCalled).toBe(true);
      expect(provider1.sentEvents).toHaveLength(0);
      provider1.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 200));
      vi.useFakeTimers();
      expect(provider1.sentEvents.length).toBeGreaterThanOrEqual(8);
    });
  });
  describe("🎯 Event Sending Before and After Provider Loading", () => {
    it("should handle events sent before and after provider loading", async () => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: true,
          batchSize: 5,
        },
        performanceMonitor,
      );
      engine.addProvider(provider1, "amplitude");
      engine.send("before_1", { timing: "before" });
      engine.send("before_2", { timing: "before" });
      expect(provider1.sentEvents).toHaveLength(0);
      expect(engine.getQueueSize()).toBeGreaterThan(0);
      provider1.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();
      expect(provider1.sentEvents).toHaveLength(2);
      engine.send("after_1", { timing: "after" });
      engine.send("after_2", { timing: "after" });
      expect(provider1.sentEvents).toHaveLength(4);
      expect(provider1.sentEvents[0].eventName).toBe("before_1");
      expect(provider1.sentEvents[1].eventName).toBe("before_2");
      expect(provider1.sentEvents[2].eventName).toBe("after_1");
      expect(provider1.sentEvents[3].eventName).toBe("after_2");
    });
    it("should handle rapid events during provider loading", async () => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: true,
          batchSize: 10,
        },
        performanceMonitor,
      );
      engine.addProvider(provider1, "amplitude");
      for (let i = 0; i < 20; i++) {
        engine.send(`rapid_${i}`, { index: i });
      }
      expect(provider1.sentEvents).toHaveLength(0);
      provider1.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 100));
      vi.useFakeTimers();
      expect(provider1.sentEvents).toHaveLength(20);
      for (let i = 20; i < 30; i++) {
        engine.send(`post_ready_${i}`, { index: i });
      }
      expect(provider1.sentEvents).toHaveLength(30);
    });
  });
  describe("🗄️ Smart Queue Management", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: true,
          maxQueueSize: 20,
          maxProviderQueueSize: 10,
          enableSmartDequeue: true,
          maxSentEventsToKeep: 5,
        },
        performanceMonitor,
      );
    });
    it("should handle queue overflow gracefully", () => {
      engine.addProvider(provider1, "amplitude");
      for (let i = 0; i < 25; i++) {
        engine.send(`overflow_${i}`, { index: i });
      }
      expect(engine.getQueueSize()).toBeLessThan(30);
      expect(engine.getQueueSize()).toBeGreaterThan(0);
    });
    it("should flush all queues when providers become ready", async () => {
      engine.addProvider(provider1, "amplitude");
      engine.addProvider(provider2, "google-analytics");
      engine.sendToProviders("amp_event", ["amplitude"], {
        data: "amp",
      });
      engine.sendToProviders("ga_event", ["google-analytics"], {
        data: "ga",
      });
      engine.send("global_event", { data: "global" });
      provider1.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();
      expect(provider1.sentEvents).toHaveLength(2);
      expect(provider2.sentEvents).toHaveLength(0);
      provider2.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();
      expect(provider2.sentEvents).toHaveLength(2);
    });
    it("should clear queue on demand", async () => {
      engine.addProvider(provider1, "amplitude");
      engine.send("clear_test_1", { data: "test1" });
      engine.send("clear_test_2", { data: "test2" });
      expect(engine.getQueueSize()).toBeGreaterThan(0);
      engine.clearQueue();
      expect(engine.getQueueSize()).toBe(0);
      provider1.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();
      expect(provider1.sentEvents).toHaveLength(0);
    });
  });
  describe("🔄 Aggressive Flushing Scenarios", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: true,
          batchSize: 5,
          batchTimeout: 500,
          enableSmartDequeue: true,
        },
        performanceMonitor,
      );
    });
    it("should aggressively flush when a provider becomes ready", async () => {
      engine.addProvider(provider1, "amplitude");
      engine.addProvider(provider2, "google-analytics");
      engine.send("flush_1", { data: "test1" });
      engine.send("flush_2", { data: "test2" });
      engine.send("flush_3", { data: "test3" });
      provider1.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();
      expect(provider1.sentEvents).toHaveLength(3);
      expect(provider2.sentEvents).toHaveLength(0);
      engine.send("flush_4", { data: "test4" });
      engine.send("flush_5", { data: "test5" });
      expect(provider1.sentEvents).toHaveLength(5);
      provider2.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();
      expect(provider2.sentEvents).toHaveLength(5);
    });
  });
  describe("🔧 Error Handling During Loading", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: true,
          maxRetries: 3,
          batchSize: 5,
        },
        performanceMonitor,
      );
    });
    it("should handle failed provider loads gracefully", async () => {
      provider1.shouldFailLoad = true;
      engine.addProvider(provider1, "amplitude");
      engine.send("retry_test", { data: "test" });
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 100));
      vi.useFakeTimers();
      expect(provider1.loadCallCount).toBe(1);
      expect(engine.getQueueSize()).toBeGreaterThan(0);
      const state = engine.getProviderState("amplitude");
      expect([ProviderState.LOADING, ProviderState.ERROR]).toContain(state);
    });
    it("should continue with other providers when one fails", async () => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: true,
          batchSize: 5,
        },
        performanceMonitor,
      );
      engine.addProvider(provider1, "amplitude");
      engine.addProvider(provider2, "google-analytics");
      engine.send("resilience_1", { data: "test1" });
      engine.send("resilience_2", { data: "test2" });
      expect(provider1.loadCalled).toBe(true);
      expect(provider2.loadCalled).toBe(true);
      provider2.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 100));
      vi.useFakeTimers();
      expect(provider2.sentEvents).toHaveLength(2);
      expect(provider1.sentEvents).toHaveLength(0);
      expect(engine.getProviderState("amplitude")).toBe(ProviderState.LOADING);
      expect(engine.getProviderState("google-analytics")).toBe(
        ProviderState.READY,
      );
    });
  });
  describe("🌍 Context and Global Properties", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: false,
          contextCacheTimeout: 5000,
        },
        performanceMonitor,
      );
      engine.addProvider(provider1, "amplitude");
      provider1.triggerLoadCallback();
      provider1.clear();
    });
    it("should merge global properties with events", () => {
      engine.setGlobalProperties({
        appVersion: "1.0.0",
        platform: "web",
        userId: "test_user_123",
      });
      engine.send("properties_test", { eventData: "test" });
      expect(provider1.sentEvents).toHaveLength(1);
      expect(provider1.sentEvents[0].options).toMatchObject({
        appVersion: "1.0.0",
        platform: "web",
        userId: "test_user_123",
        eventData: "test",
      });
    });
    it("should set userId on ready providers", () => {
      engine.setUserId("user_456");
      expect(provider1.userIdSet).toBe("user_456");
    });
  });
  describe("🚀 High-Volume Mixed Scenarios", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine(
        {
          lazyLoading: true,
          maxQueueSize: 2000,
          maxProviderQueueSize: 1000,
          batchSize: 50,
          batchTimeout: 1000,
          enableSmartDequeue: true,
        },
        performanceMonitor,
      );
      engine.addProvider(provider1, "amplitude");
      engine.addProvider(provider2, "google-analytics");
    });
    it("should handle high-volume events with lazy loading", async () => {
      const TOTAL_EVENTS = 100;
      for (let i = 0; i < TOTAL_EVENTS; i++) {
        engine.send(`burst_${i}`, {
          index: i,
          timestamp: Date.now(),
          phase: "pre-load",
        });
      }
      provider1.triggerLoadCallback();
      provider2.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      vi.useFakeTimers();
      engine.flushQueue();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 200));
      vi.useFakeTimers();
      expect(provider1.sentEvents.length).toBeGreaterThan(TOTAL_EVENTS * 0.8);
      expect(provider2.sentEvents.length).toBeGreaterThan(TOTAL_EVENTS * 0.8);
    });
  });
  describe("🔄 Lifecycle Management", () => {
    beforeEach(() => {
      engine = new AnalyticsEngine({
        lazyLoading: false,
        batchSize: 5,
      });
    });
    it("should initialize providers after loading", () => {
      engine.addProvider(provider1, "amplitude");
      engine.addProvider(provider2, "google-analytics");
      provider1.triggerLoadCallback();
      provider2.triggerLoadCallback();
      engine.init();
      expect(provider1.initCalled).toBe(true);
      expect(provider2.initCalled).toBe(true);
    });
    it("should reset engine state properly", async () => {
      engine.addProvider(provider1, "amplitude");
      provider1.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();
      engine.send("reset_test", { data: "test" });
      expect(provider1.sentEvents).toHaveLength(1);
      engine.reset();
      expect(engine.getQueueSize()).toBe(0);
      expect(engine.getProviderState("amplitude")).toBe(
        ProviderState.UNINITIALIZED,
      );
    });
    it("should destroy properly", () => {
      engine.addProvider(provider1, "amplitude");
      engine.addProvider(provider2, "google-analytics");
      engine.destroy();
      expect(provider1.destroyCalled).toBe(true);
      expect(provider2.destroyCalled).toBe(true);
      expect(() => engine.send("post_destroy", { data: "test" })).not.toThrow();
    });
  });
});
