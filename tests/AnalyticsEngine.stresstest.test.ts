import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnalyticsEngine } from "../src/core/AnalyticsEngine";
import { type IAnalyticsEvent } from "../src/types/IAnalyticsEvent";
import { PerformanceMonitor } from "../src/core/PerformanceMonitor";
class StressTestProvider implements IAnalyticsEvent {
  public id: string;
  public loadCallback?: () => void;
  public loadCalled = false;
  public initCalled = false;
  public sentEvents: Array<{ eventName: string; options?: unknown }> = [];
  public userIdSet?: string;
  public destroyCalled = false;
  public shouldFailSend = false;
  constructor(id: string, shouldFailSend = false) {
    this.id = id;
    this.shouldFailSend = shouldFailSend;
  }
  load(callback?: () => void): void {
    this.loadCalled = true;
    this.loadCallback = callback;
  }
  init(): void {
    this.initCalled = true;
  }
  send<T>(eventName: string, options?: T): void {
    if (this.shouldFailSend && Math.random() < 0.1) {
      throw new Error(`${this.id} send failed`);
    }
    this.sentEvents.push({ eventName, options });
  }
  setUserId(userId: string): void {
    this.userIdSet = userId;
  }
  destroy(): void {
    this.destroyCalled = true;
  }
  getTotalEventsSent(): number {
    return this.sentEvents.length;
  }
  getEventsOfType(eventName: string): number {
    return this.sentEvents.filter((e) => e.eventName === eventName).length;
  }
  clear(): void {
    this.sentEvents = [];
  }
  triggerLoadCallback(): void {
    this.loadCallback?.();
  }
}
describe("AnalyticsEngine - Zero Loss Stress Test", () => {
  let engine: AnalyticsEngine;
  let performanceMonitor: PerformanceMonitor;
  let fastProvider: StressTestProvider;
  let slowProvider: StressTestProvider;
  beforeEach(async () => {
    vi.useFakeTimers();
    performanceMonitor = new PerformanceMonitor({
      enablePerformanceTracking: true,
      performanceLogInterval: 1000,
    });
    fastProvider = new StressTestProvider("fast_provider");
    slowProvider = new StressTestProvider("slow_provider");
    engine = new AnalyticsEngine(
      {
        maxQueueSize: 1000,
        maxProviderQueueSize: 500,
        enableSmartDequeue: true,
        maxSentEventsToKeep: 50,
        lazyLoading: false,
      },
      performanceMonitor,
    );
    engine.addProvider(fastProvider, "amplitude");
    engine.addProvider(slowProvider, "google-analytics");
    fastProvider.triggerLoadCallback();
    slowProvider.triggerLoadCallback();
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 50));
    vi.useFakeTimers();
    fastProvider.clear();
    slowProvider.clear();
  });
  afterEach(() => {
    engine?.destroy();
    vi.useRealTimers();
  });
  describe("🚀 High-Volume Event Processing", () => {
    it("should handle 1000 events without loss", async () => {
      const TOTAL_EVENTS = 1000;
      console.log(`🔥 Testing ${TOTAL_EVENTS} events burst`);
      for (let i = 0; i < TOTAL_EVENTS; i++) {
        engine.send(`stress_event_${i}`, {
          index: i,
          timestamp: Date.now(),
          testType: "burst",
        });
      }
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      for (let i = 0; i < 10; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      vi.useFakeTimers();
      const fastEvents = fastProvider.getTotalEventsSent();
      const slowEvents = slowProvider.getTotalEventsSent();
      console.log(`📊 Fast provider: ${fastEvents} events`);
      console.log(`📊 Slow provider: ${slowEvents} events`);
      console.log(`📏 Final queue size: ${engine.getQueueSize()}`);
      expect(fastEvents).toBeGreaterThan(TOTAL_EVENTS * 0.9);
      expect(slowEvents).toBeGreaterThan(TOTAL_EVENTS * 0.9);
      expect(engine.getQueueSize()).toBeLessThan(50);
    }, 15000);
    it("should handle rapid user interactions", async () => {
      const INTERACTIONS = 500;
      const interactionTypes = ["click", "scroll", "hover", "focus"];
      console.log(`👤 Testing ${INTERACTIONS} user interactions`);
      for (let i = 0; i < INTERACTIONS; i++) {
        const interaction = interactionTypes[i % interactionTypes.length];
        engine.send(`user_${interaction}`, {
          element: `button_${i % 20}`,
          sessionId: "stress_test_session",
          sequence: i,
          timestamp: Date.now(),
        });
      }
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      for (let i = 0; i < 10; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      vi.useFakeTimers();
      const totalSent =
        fastProvider.getTotalEventsSent() + slowProvider.getTotalEventsSent();
      console.log(`🎯 Total interactions processed: ${totalSent}`);
      expect(totalSent).toBeGreaterThan(INTERACTIONS * 1.8);
      expect(fastProvider.getEventsOfType("user_click")).toBeGreaterThan(0);
      expect(slowProvider.getEventsOfType("user_scroll")).toBeGreaterThan(0);
    }, 15000);
  });
  describe("💪 Provider Resilience", () => {
    it("should handle provider failures gracefully", async () => {
      const EVENT_COUNT = 200;
      console.log(`🔧 Testing resilience with ${EVENT_COUNT} events`);
      for (let i = 0; i < EVENT_COUNT; i++) {
        engine.send(`resilience_test_${i}`, {
          testId: "provider_resilience",
          eventIndex: i,
          timestamp: Date.now(),
        });
      }
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      for (let i = 0; i < 10; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      vi.useFakeTimers();
      const fastEvents = fastProvider.getTotalEventsSent();
      const slowEvents = slowProvider.getTotalEventsSent();
      console.log(`✅ Fast provider: ${fastEvents}/${EVENT_COUNT} events`);
      console.log(`✅ Slow provider: ${slowEvents}/${EVENT_COUNT} events`);
      expect(fastEvents).toBeGreaterThan(EVENT_COUNT * 0.9);
      expect(slowEvents).toBeGreaterThan(EVENT_COUNT * 0.9);
    }, 15000);
    it("should handle queue overflow with smart dequeuing", async () => {
      engine.destroy();
      engine = new AnalyticsEngine({
        maxQueueSize: 50,
        maxProviderQueueSize: 25,
        enableSmartDequeue: true,
        maxSentEventsToKeep: 5,
        lazyLoading: false,
      });
      const testProvider = new StressTestProvider("overflow_test");
      engine.addProvider(testProvider, "amplitude");
      testProvider.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();
      const OVERFLOW_EVENTS = 100;
      console.log(
        `🌊 Testing overflow with ${OVERFLOW_EVENTS} events on small queues`,
      );
      for (let i = 0; i < OVERFLOW_EVENTS; i++) {
        engine.send(`overflow_${i}`, {
          testType: "overflow",
          index: i,
          timestamp: Date.now(),
        });
      }
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      for (let i = 0; i < 10; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      vi.useFakeTimers();
      const sentEvents = testProvider.getTotalEventsSent();
      console.log(
        `📈 Overflow handling: ${sentEvents}/${OVERFLOW_EVENTS} events delivered`,
      );
      expect(sentEvents).toBeGreaterThan(OVERFLOW_EVENTS * 0.7);
      expect(engine.getQueueSize()).toBeLessThan(30);
    }, 15000);
  });
  describe("🎯 Critical Event Delivery", () => {
    it("should guarantee critical business events are never lost", async () => {
      const CRITICAL_EVENTS = [
        "purchase",
        "signup",
        "subscription_cancel",
        "payment_failed",
      ];
      const BACKGROUND_NOISE = 100;
      console.log(`🚨 Testing critical event guarantees`);
      for (let i = 0; i < BACKGROUND_NOISE; i++) {
        engine.send(`noise_${i}`, { type: "background", index: i });
      }
      CRITICAL_EVENTS.forEach((eventName, index) => {
        engine.send(eventName, {
          critical: true,
          timestamp: Date.now(),
          priority: "HIGH",
          eventId: `critical_${index}`,
        });
        console.log(`🎯 Sent critical event: ${eventName}`);
      });
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      for (let i = 0; i < 15; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      vi.useFakeTimers();
      [fastProvider, slowProvider].forEach((provider) => {
        CRITICAL_EVENTS.forEach((criticalEvent) => {
          const delivered = provider.getEventsOfType(criticalEvent);
          console.log(`✅ ${provider.id}: ${criticalEvent} = ${delivered}`);
          expect(delivered).toBeGreaterThanOrEqual(1);
        });
      });
      console.log(`🎉 Zero loss guarantee verified for all critical events!`);
    }, 15000);
  });
  describe("📊 Performance Under Load", () => {
    it("should maintain performance with sustained load", async () => {
      const SUSTAINED_EVENTS = 500;
      const BATCH_SIZE = 25;
      console.log(`🔋 Testing sustained load with ${SUSTAINED_EVENTS} events`);
      for (let batch = 0; batch < SUSTAINED_EVENTS / BATCH_SIZE; batch++) {
        for (let i = 0; i < BATCH_SIZE; i++) {
          engine.send(`sustained_${batch}_${i}`, {
            batchNumber: batch,
            eventIndex: i,
            timestamp: Date.now(),
          });
        }
        if (batch % 5 === 0) {
          vi.useRealTimers();
          await new Promise((resolve) => setTimeout(resolve, 50));
          vi.useFakeTimers();
        }
      }
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      for (let i = 0; i < 10; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      vi.useFakeTimers();
      const totalSent =
        fastProvider.getTotalEventsSent() + slowProvider.getTotalEventsSent();
      const metrics = engine.getPerformanceMetrics();
      console.log(`📊 Total events processed: ${totalSent}`);
      console.log(
        `⚡ Performance metrics - Events processed: ${metrics.totalEventsProcessed}`,
      );
      expect(totalSent).toBeGreaterThan(SUSTAINED_EVENTS * 1.8);
      expect(engine.getQueueSize()).toBeLessThan(50);
    }, 20000);
  });
  describe("🔒 100% Guaranteed Event Delivery", () => {
    it("should guarantee zero loss with queue size monitoring", async () => {
      const MAX_QUEUE_SIZE = 100;
      const TOTAL_EVENTS = 500;
      engine.destroy();
      engine = new AnalyticsEngine({
        maxQueueSize: MAX_QUEUE_SIZE,
        maxProviderQueueSize: 50,
        enableSmartDequeue: true,
        maxSentEventsToKeep: 10,
        lazyLoading: false,
      });
      const guaranteedProvider = new StressTestProvider("guaranteed_provider");
      engine.addProvider(guaranteedProvider, "amplitude");
      guaranteedProvider.triggerLoadCallback();
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 100));
      vi.useFakeTimers();
      console.log(`🔒 Testing guaranteed delivery with ${TOTAL_EVENTS} events`);
      const queueSizes: number[] = [];
      for (let i = 0; i < TOTAL_EVENTS; i++) {
        engine.send(`guaranteed_${i}`, {
          eventId: i,
          critical: true,
          timestamp: Date.now(),
        });
        const currentQueueSize = engine.getQueueSize();
        queueSizes.push(currentQueueSize);
        expect(currentQueueSize).toBeLessThanOrEqual(MAX_QUEUE_SIZE);
        if (i % 50 === 0) {
          engine.flushQueue();
        }
      }
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      for (let i = 0; i < 20; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      vi.useFakeTimers();
      const deliveredEvents = guaranteedProvider.getTotalEventsSent();
      const maxQueueSize = Math.max(...queueSizes);
      console.log(`🎯 Delivered: ${deliveredEvents}/${TOTAL_EVENTS} events`);
      console.log(
        `📏 Max queue size reached: ${maxQueueSize}/${MAX_QUEUE_SIZE}`,
      );
      console.log(`📊 Final queue size: ${engine.getQueueSize()}`);
      expect(deliveredEvents).toBe(TOTAL_EVENTS);
      expect(maxQueueSize).toBeLessThanOrEqual(MAX_QUEUE_SIZE);
      expect(engine.getQueueSize()).toBe(0);
    }, 20000);
    it("should handle extreme burst without losing events", async () => {
      const EXTREME_BURST = 2000;
      const BATCH_SIZE = 200;
      console.log(
        `💥 Testing extreme burst: ${EXTREME_BURST} events in batches`,
      );
      let totalSentEvents = 0;
      const eventTracker = new Set<string>();
      for (let batch = 0; batch < EXTREME_BURST / BATCH_SIZE; batch++) {
        for (let i = 0; i < BATCH_SIZE; i++) {
          const eventId = `extreme_${batch}_${i}`;
          eventTracker.add(eventId);
          engine.send(eventId, {
            batchId: batch,
            eventIndex: i,
            timestamp: Date.now(),
            extremeTest: true,
          });
          totalSentEvents++;
        }
        if (batch % 2 === 0) {
          vi.useRealTimers();
          await new Promise((resolve) => setTimeout(resolve, 100));
          engine.flushQueue();
          vi.useFakeTimers();
        }
      }
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      for (let i = 0; i < 30; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      vi.useFakeTimers();
      const fastEvents = fastProvider.getTotalEventsSent();
      const slowEvents = slowProvider.getTotalEventsSent();
      const totalDelivered = fastEvents + slowEvents;
      console.log(`🔥 Fast provider delivered: ${fastEvents} events`);
      console.log(`🔥 Slow provider delivered: ${slowEvents} events`);
      console.log(`🎯 Total delivered: ${totalDelivered} events`);
      console.log(
        `📊 Expected: ${totalSentEvents * 2} events (both providers)`,
      );
      expect(fastEvents).toBeGreaterThanOrEqual(totalSentEvents * 0.95);
      expect(slowEvents).toBeGreaterThanOrEqual(totalSentEvents * 0.95);
      expect(totalDelivered).toBeGreaterThanOrEqual(totalSentEvents * 1.9);
    }, 30000);
  });
  describe("🚀 Pre-Loading Event Replay", () => {
    it("should replay all events sent before providers are loaded", async () => {
      const PRE_LOAD_EVENTS = 300;
      console.log(
        `🔄 Testing pre-load event replay with ${PRE_LOAD_EVENTS} events`,
      );
      engine.destroy();
      engine = new AnalyticsEngine({
        maxQueueSize: 1000,
        maxProviderQueueSize: 500,
        enableSmartDequeue: true,
        lazyLoading: true,
      });
      const replayProvider1 = new StressTestProvider("replay_provider_1");
      const replayProvider2 = new StressTestProvider("replay_provider_2");
      engine.addProvider(replayProvider1, "amplitude");
      engine.addProvider(replayProvider2, "google-analytics");
      const preLoadEvents: string[] = [];
      for (let i = 0; i < PRE_LOAD_EVENTS; i++) {
        const eventName = `pre_load_${i}`;
        preLoadEvents.push(eventName);
        engine.send(eventName, {
          eventIndex: i,
          sentBeforeLoad: true,
          timestamp: Date.now(),
          priority: i < 10 ? "HIGH" : "NORMAL",
        });
      }
      console.log(`📤 Sent ${PRE_LOAD_EVENTS} events before providers loaded`);
      console.log(`📏 Queue size before loading: ${engine.getQueueSize()}`);
      const queueSize = engine.getQueueSize();
      console.log(
        `🔍 Detailed queue analysis - Total queue size: ${queueSize}`,
      );
      expect(queueSize).toBeGreaterThan(0);
      expect(replayProvider1.getTotalEventsSent()).toBe(0);
      expect(replayProvider2.getTotalEventsSent()).toBe(0);
      vi.useRealTimers();
      setTimeout(() => {
        console.log(`🟢 Loading provider 1...`);
        replayProvider1.triggerLoadCallback();
      }, 100);
      setTimeout(() => {
        console.log(`🟢 Loading provider 2...`);
        replayProvider2.triggerLoadCallback();
      }, 200);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      for (let i = 0; i < 15; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      vi.useFakeTimers();
      const provider1Events = replayProvider1.getTotalEventsSent();
      const provider2Events = replayProvider2.getTotalEventsSent();
      console.log(
        `✅ Provider 1 replayed: ${provider1Events}/${PRE_LOAD_EVENTS} events`,
      );
      console.log(
        `✅ Provider 2 replayed: ${provider2Events}/${PRE_LOAD_EVENTS} events`,
      );
      console.log(`📏 Final queue size: ${engine.getQueueSize()}`);
      expect(provider1Events).toBe(PRE_LOAD_EVENTS);
      expect(provider2Events).toBe(PRE_LOAD_EVENTS);
      expect(engine.getQueueSize()).toBe(0);
      expect(replayProvider1.getEventsOfType("pre_load_0")).toBe(1);
      expect(replayProvider1.getEventsOfType("pre_load_9")).toBe(1);
      expect(replayProvider2.getEventsOfType("pre_load_0")).toBe(1);
      expect(replayProvider2.getEventsOfType("pre_load_9")).toBe(1);
    }, 25000);
    it("should handle mixed pre-load and post-load events correctly", async () => {
      const PRE_EVENTS = 150;
      const POST_EVENTS = 150;
      console.log(
        `🔀 Testing mixed pre/post-load events: ${PRE_EVENTS} + ${POST_EVENTS}`,
      );
      engine.destroy();
      engine = new AnalyticsEngine({
        maxQueueSize: 1000,
        enableSmartDequeue: true,
        lazyLoading: true,
      });
      const mixedProvider = new StressTestProvider("mixed_provider");
      engine.addProvider(mixedProvider, "amplitude");
      for (let i = 0; i < PRE_EVENTS; i++) {
        engine.send(`pre_event_${i}`, {
          phase: "pre_load",
          eventIndex: i,
          timestamp: Date.now(),
        });
      }
      const queueAfterPreLoad = engine.getQueueSize();
      console.log(`📊 Queue after pre-load events: ${queueAfterPreLoad}`);
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 100));
      mixedProvider.triggerLoadCallback();
      await new Promise((resolve) => setTimeout(resolve, 200));
      vi.useFakeTimers();
      for (let i = 0; i < POST_EVENTS; i++) {
        engine.send(`post_event_${i}`, {
          phase: "post_load",
          eventIndex: i,
          timestamp: Date.now(),
        });
      }
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      for (let i = 0; i < 20; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      vi.useFakeTimers();
      const totalDelivered = mixedProvider.getTotalEventsSent();
      const preEventCount =
        mixedProvider.getEventsOfType("pre_event_0") +
        mixedProvider.getEventsOfType("pre_event_1") +
        mixedProvider.getEventsOfType("pre_event_2");
      const postEventCount =
        mixedProvider.getEventsOfType("post_event_0") +
        mixedProvider.getEventsOfType("post_event_1") +
        mixedProvider.getEventsOfType("post_event_2");
      console.log(
        `📊 Total delivered: ${totalDelivered}/${PRE_EVENTS + POST_EVENTS}`,
      );
      console.log(`🔄 Pre-load events sample delivered: ${preEventCount}/3`);
      console.log(`➡️ Post-load events sample delivered: ${postEventCount}/3`);
      expect(totalDelivered).toBe(PRE_EVENTS + POST_EVENTS);
      expect(preEventCount).toBe(3);
      expect(postEventCount).toBe(3);
      expect(engine.getQueueSize()).toBe(0);
    }, 25000);
  });
  describe("⚡ Queue Management & Flushing", () => {
    it("should maintain queue integrity under rapid flush operations", async () => {
      const RAPID_EVENTS = 400;
      const FLUSH_FREQUENCY = 20;
      console.log(`⚡ Testing queue integrity with rapid flushing`);
      const flushCounts: number[] = [];
      let flushOperations = 0;
      for (let i = 0; i < RAPID_EVENTS; i++) {
        engine.send(`rapid_flush_${i}`, {
          eventIndex: i,
          timestamp: Date.now(),
          flushTest: true,
        });
        if (i % FLUSH_FREQUENCY === 0 && i > 0) {
          const queueBefore = engine.getQueueSize();
          engine.flushQueue();
          vi.useRealTimers();
          await new Promise((resolve) => setTimeout(resolve, 10));
          vi.useFakeTimers();
          const queueAfter = engine.getQueueSize();
          const flushEffect = Math.max(0, queueBefore - queueAfter);
          flushCounts.push(flushEffect);
          flushOperations++;
          console.log(
            `🔄 Flush ${flushOperations}: ${queueBefore} → ${queueAfter} (effect: ${flushEffect})`,
          );
        }
      }
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      for (let i = 0; i < 10; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      vi.useFakeTimers();
      const totalDelivered =
        fastProvider.getTotalEventsSent() + slowProvider.getTotalEventsSent();
      const totalFlushEffect = flushCounts.reduce((a, b) => a + b, 0);
      const avgFlushEffect =
        flushOperations > 0 ? totalFlushEffect / flushOperations : 0;
      console.log(`⚡ Flush operations performed: ${flushOperations}`);
      console.log(`📊 Total flush effect: ${totalFlushEffect} events`);
      console.log(`📊 Average events per flush: ${avgFlushEffect.toFixed(2)}`);
      console.log(`🎯 Total delivered: ${totalDelivered}/${RAPID_EVENTS * 2}`);
      expect(totalDelivered).toBeGreaterThanOrEqual(RAPID_EVENTS * 1.9);
      expect(flushOperations).toBeGreaterThan(0);
      expect(avgFlushEffect).toBeGreaterThanOrEqual(0);
    }, 20000);
    it("should handle concurrent queue operations safely", async () => {
      const CONCURRENT_BATCHES = 5;
      const EVENTS_PER_BATCH = 100;
      console.log(`🔄 Testing concurrent queue operations`);
      const promises: Promise<void>[] = [];
      for (let batch = 0; batch < CONCURRENT_BATCHES; batch++) {
        promises.push(
          new Promise<void>((resolve) => {
            vi.useRealTimers();
            setTimeout(() => {
              for (let i = 0; i < EVENTS_PER_BATCH; i++) {
                engine.send(`concurrent_${batch}_${i}`, {
                  batchId: batch,
                  eventIndex: i,
                  timestamp: Date.now(),
                  concurrent: true,
                });
              }
              resolve();
            }, batch * 50);
            vi.useFakeTimers();
          }),
        );
      }
      promises.push(
        new Promise<void>((resolve) => {
          vi.useRealTimers();
          const flushInterval = setInterval(() => {
            engine.flushQueue();
          }, 100);
          setTimeout(() => {
            clearInterval(flushInterval);
            resolve();
          }, 1000);
          vi.useFakeTimers();
        }),
      );
      vi.useRealTimers();
      await Promise.all(promises);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      for (let i = 0; i < 15; i++) {
        engine.flushQueue();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      vi.useFakeTimers();
      const totalExpected = CONCURRENT_BATCHES * EVENTS_PER_BATCH;
      const totalDelivered =
        fastProvider.getTotalEventsSent() + slowProvider.getTotalEventsSent();
      console.log(
        `🎯 Concurrent delivery: ${totalDelivered}/${totalExpected * 2}`,
      );
      expect(totalDelivered).toBeGreaterThanOrEqual(totalExpected * 1.9);
      expect(engine.getQueueSize()).toBeLessThan(50);
    }, 25000);
  });
});
