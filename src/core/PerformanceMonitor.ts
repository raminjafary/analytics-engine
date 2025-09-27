import type { IAnalyticsLogger } from "./AnalyticsLogger";
import { NoOpAnalyticsLogger } from "./AnalyticsLogger";
export interface PerformanceMetrics {
  providerLoadTimes: Map<string, number>;
  providerLoadAttempts: Map<string, number>;
  providerLoadFailures: Map<string, number>;
  batchProcessingTimes: number[];
  totalEventsProcessed: number;
  batchCount: number;
  averageBatchSize: number;
  maxQueueSize: number;
  queueOverflows: number;
  averageQueueSize: number;
  contextCacheHits: number;
  contextCacheMisses: number;
  eventProcessingTimes: number[];
  failedEvents: number;
  retriedEvents: number;
  activeTimers: number;
  activePromises: number;
  startTime: number;
  lastMetricsReset: number;
}
export interface PerformanceMonitorConfig {
  enablePerformanceTracking: boolean;
  performanceLogInterval: number;
  logger?: IAnalyticsLogger;
}
export interface ProviderStats {
  total: number;
  ready: number;
  loading: number;
  error: number;
  uninitialized: number;
  queueSizes: Record<string, number>;
  isLazyLoading: boolean;
}
export interface IPerformanceMonitor {
  start(): void;
  stop(): void;
  reset(): void;
  getMetrics(): PerformanceMetrics;
  trackProviderLoadStart(providerName: string): void;
  trackProviderLoadComplete(providerName: string, loadTime: number): void;
  trackProviderLoadFailure(providerName: string): void;
  trackEventProcessingStart(): number;
  trackEventProcessingComplete(startTime: number): void;
  trackEventProcessed(): void;
  trackBatchProcessingStart(): number;
  trackBatchProcessingComplete(startTime: number, batchSize: number): void;
  trackQueueSize(currentSize: number): void;
  trackQueueOverflow(): void;
  trackContextCacheHit(): void;
  trackContextCacheMiss(): void;
  trackEventFailure(): void;
  trackEventRetry(): void;
  trackActiveTimer(increment: boolean): void;
  trackActivePromise(increment: boolean): void;
  logPerformanceMetrics(providerStats: ProviderStats): void;
}
export class PerformanceMonitor implements IPerformanceMonitor {
  private metrics: PerformanceMetrics;
  private config: PerformanceMonitorConfig;
  private logTimer?: NodeJS.Timeout;
  private isBrowser: boolean;
  private logger: IAnalyticsLogger;
  constructor(config: PerformanceMonitorConfig) {
    this.config = config;
    this.logger = config.logger || new NoOpAnalyticsLogger();
    this.isBrowser = typeof window !== "undefined";
    this.metrics = {
      providerLoadTimes: new Map(),
      providerLoadAttempts: new Map(),
      providerLoadFailures: new Map(),
      batchProcessingTimes: [],
      totalEventsProcessed: 0,
      batchCount: 0,
      averageBatchSize: 0,
      maxQueueSize: 0,
      queueOverflows: 0,
      averageQueueSize: 0,
      contextCacheHits: 0,
      contextCacheMisses: 0,
      eventProcessingTimes: [],
      failedEvents: 0,
      retriedEvents: 0,
      activeTimers: 0,
      activePromises: 0,
      startTime: Date.now(),
      lastMetricsReset: Date.now(),
    };
  }
  start(): void {
    if (!this.config.enablePerformanceTracking || !this.isBrowser) {
      return;
    }
    this.metrics.startTime = Date.now();
    this.startPerformanceLogging();
  }
  stop(): void {
    if (this.logTimer) {
      clearInterval(this.logTimer);
      this.logTimer = undefined;
    }
  }
  reset(): void {
    const now = Date.now();
    this.metrics = {
      ...this.metrics,
      batchProcessingTimes: [],
      totalEventsProcessed: 0,
      batchCount: 0,
      queueOverflows: 0,
      contextCacheHits: 0,
      contextCacheMisses: 0,
      eventProcessingTimes: [],
      failedEvents: 0,
      retriedEvents: 0,
      lastMetricsReset: now,
    };
  }
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  trackProviderLoadStart(providerName: string): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.providerLoadAttempts.set(
      providerName,
      (this.metrics.providerLoadAttempts.get(providerName) || 0) + 1,
    );
    this.metrics.activePromises++;
  }
  trackProviderLoadComplete(providerName: string, loadTime: number): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.providerLoadTimes.set(providerName, loadTime);
    this.metrics.activePromises--;
  }
  trackProviderLoadFailure(providerName: string): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.providerLoadFailures.set(
      providerName,
      (this.metrics.providerLoadFailures.get(providerName) || 0) + 1,
    );
    this.metrics.activePromises--;
  }
  trackEventProcessingStart(): number {
    if (!this.config.enablePerformanceTracking) return 0;
    if (typeof performance !== "undefined" && performance.now) {
      return performance.now();
    }
    return Date.now();
  }
  trackEventProcessingComplete(startTime: number): void {
    if (!this.config.enablePerformanceTracking || startTime === 0) return;
    let processingTime: number;
    if (typeof performance !== "undefined" && performance.now) {
      processingTime = performance.now() - startTime;
    } else {
      processingTime = Date.now() - startTime;
    }
    this.metrics.eventProcessingTimes.push(processingTime);
    if (this.metrics.eventProcessingTimes.length > 1000) {
      this.metrics.eventProcessingTimes.splice(0, 500);
    }
  }
  trackEventProcessed(): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.totalEventsProcessed++;
  }
  trackBatchProcessingStart(): number {
    if (!this.config.enablePerformanceTracking) return 0;
    if (typeof performance !== "undefined" && performance.now) {
      return performance.now();
    }
    return Date.now();
  }
  trackBatchProcessingComplete(startTime: number, batchSize: number): void {
    if (
      !this.config.enablePerformanceTracking ||
      startTime === 0 ||
      batchSize === 0
    )
      return;
    let batchProcessingTime: number;
    if (typeof performance !== "undefined" && performance.now) {
      batchProcessingTime = performance.now() - startTime;
    } else {
      batchProcessingTime = Date.now() - startTime;
    }
    this.metrics.batchProcessingTimes.push(batchProcessingTime);
    this.metrics.batchCount++;
    this.metrics.averageBatchSize =
      (this.metrics.averageBatchSize * (this.metrics.batchCount - 1) +
        batchSize) /
      this.metrics.batchCount;
    if (this.metrics.batchProcessingTimes.length > 1000) {
      this.metrics.batchProcessingTimes.splice(0, 500);
    }
  }
  trackQueueSize(currentSize: number): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.maxQueueSize = Math.max(
      this.metrics.maxQueueSize,
      currentSize,
    );
    this.metrics.averageQueueSize =
      (this.metrics.averageQueueSize + currentSize) / 2;
  }
  trackQueueOverflow(): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.queueOverflows++;
  }
  trackContextCacheHit(): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.contextCacheHits++;
  }
  trackContextCacheMiss(): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.contextCacheMisses++;
  }
  trackEventFailure(): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.failedEvents++;
  }
  trackEventRetry(): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.retriedEvents++;
  }
  trackActiveTimer(increment: boolean): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.activeTimers += increment ? 1 : -1;
  }
  trackActivePromise(increment: boolean): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.activePromises += increment ? 1 : -1;
  }
  logPerformanceMetrics(providerStats: ProviderStats): void {
    const metrics = {
      providers: {
        total: providerStats.total,
        ready: providerStats.ready,
        loading: providerStats.loading,
        error: providerStats.error,
        uninitialized: providerStats.uninitialized,
        averageLoadTime: this.calculateAverageLoadTime(),
        loadFailureRate: this.calculateLoadFailureRate(),
      },
      queues: {
        maxQueueSize: this.metrics.maxQueueSize,
        averageQueueSize: this.metrics.averageQueueSize,
        queueOverflows: this.metrics.queueOverflows,
        currentQueueSizes: providerStats.queueSizes,
      },
      batching: {
        totalEventsProcessed: this.metrics.totalEventsProcessed,
        batchCount: this.metrics.batchCount,
        averageBatchSize: this.metrics.averageBatchSize,
        averageBatchProcessingTime: this.calculateAverageBatchProcessingTime(),
        processingRate: this.calculateBatchProcessingRate(),
      },
      caching: {
        cacheHits: this.metrics.contextCacheHits,
        cacheMisses: this.metrics.contextCacheMisses,
        cacheHitRate: this.calculateCacheHitRate(),
      },
      events: {
        totalProcessed: this.metrics.totalEventsProcessed,
        failedEvents: this.metrics.failedEvents,
        retriedEvents: this.metrics.retriedEvents,
        averageProcessingTime: this.calculateAverageEventProcessingTime(),
        failureRate: this.calculateEventFailureRate(),
      },
      system: {
        activeTimers: this.metrics.activeTimers,
        activePromises: this.metrics.activePromises,
        memoryPressure: this.assessMemoryPressure(providerStats),
      },
    };
    this.logger.info("🔍 Analytics Engine Performance Metrics", metrics);
    this.analyzePerformanceIssues(metrics);
  }
  private startPerformanceLogging(): void {
    if (this.logTimer || !this.isBrowser) return;
    this.logTimer = setInterval(() => {
      const emptyStats: ProviderStats = {
        total: 0,
        ready: 0,
        loading: 0,
        error: 0,
        uninitialized: 0,
        queueSizes: {},
        isLazyLoading: false,
      };
      this.logPerformanceMetrics(emptyStats);
    }, this.config.performanceLogInterval);
  }
  private calculateAverageLoadTime(): string {
    const loadTimes = Array.from(this.metrics.providerLoadTimes.values());
    if (loadTimes.length === 0) return "0ms";
    const avg =
      loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length;
    return `${avg.toFixed(1)}ms`;
  }
  private calculateLoadFailureRate(): string {
    const totalAttempts = Array.from(
      this.metrics.providerLoadAttempts.values(),
    ).reduce((sum, attempts) => sum + attempts, 0);
    const totalFailures = Array.from(
      this.metrics.providerLoadFailures.values(),
    ).reduce((sum, failures) => sum + failures, 0);
    if (totalAttempts === 0) return "0%";
    return `${((totalFailures / totalAttempts) * 100).toFixed(1)}%`;
  }
  private calculateAverageBatchProcessingTime(): string {
    const times = this.metrics.batchProcessingTimes;
    if (times.length === 0) return "0ms";
    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    return `${avg.toFixed(1)}ms`;
  }
  private calculateBatchProcessingRate(): string {
    const timeSinceStart = Date.now() - this.metrics.startTime;
    const rate = (this.metrics.totalEventsProcessed / timeSinceStart) * 1000;
    return `${rate.toFixed(1)} events/sec`;
  }
  private calculateCacheHitRate(): string {
    const total =
      this.metrics.contextCacheHits + this.metrics.contextCacheMisses;
    if (total === 0) return "0%";
    return `${((this.metrics.contextCacheHits / total) * 100).toFixed(1)}%`;
  }
  private calculateAverageEventProcessingTime(): string {
    const times = this.metrics.eventProcessingTimes;
    if (times.length === 0) return "0ms";
    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    return `${avg.toFixed(1)}ms`;
  }
  private calculateEventFailureRate(): string {
    const total = this.metrics.totalEventsProcessed + this.metrics.failedEvents;
    if (total === 0) return "0%";
    return `${((this.metrics.failedEvents / total) * 100).toFixed(1)}%`;
  }
  private assessMemoryPressure(providerStats: ProviderStats): string {
    const totalQueueSize = Object.values(providerStats.queueSizes).reduce(
      (sum, size) => sum + size,
      0,
    );
    const activeObjects =
      this.metrics.activePromises + this.metrics.activeTimers;
    if (totalQueueSize > 800 || activeObjects > 50) {
      return "HIGH";
    } else if (totalQueueSize > 400 || activeObjects > 20) {
      return "MEDIUM";
    }
    return "LOW";
  }
  private analyzePerformanceIssues(metrics: {
    providers: { loadFailureRate: string };
    batching: { averageBatchProcessingTime: string };
    caching: { cacheHitRate: string };
    system: { memoryPressure: string };
  }): void {
    const issues: string[] = [];
    const recommendations: string[] = [];
    if (this.metrics.queueOverflows > 0) {
      issues.push(
        `🚨 Queue overflows detected: ${this.metrics.queueOverflows}`,
      );
      recommendations.push(
        "Consider increasing maxQueueSize or improving provider load times",
      );
    }
    const loadFailureRate = parseFloat(metrics.providers.loadFailureRate);
    if (loadFailureRate > 10) {
      issues.push(
        `🚨 High provider load failure rate: ${metrics.providers.loadFailureRate}`,
      );
      recommendations.push(
        "Check network connectivity and provider configurations",
      );
    }
    const avgBatchTime = parseFloat(
      metrics.batching.averageBatchProcessingTime,
    );
    if (avgBatchTime > 100) {
      issues.push(
        `⚠️ Slow batch processing: ${metrics.batching.averageBatchProcessingTime}`,
      );
      recommendations.push(
        "Consider reducing batch size or optimizing provider send methods",
      );
    }
    const cacheHitRate = parseFloat(metrics.caching.cacheHitRate);
    if (cacheHitRate < 80 && this.metrics.contextCacheMisses > 10) {
      issues.push(`⚠️ Low cache hit rate: ${metrics.caching.cacheHitRate}`);
      recommendations.push(
        "Consider increasing contextCacheTimeout or reviewing cache invalidation logic",
      );
    }
    if (metrics.system.memoryPressure === "HIGH") {
      issues.push("🚨 High memory pressure detected");
      recommendations.push(
        "Monitor queue sizes and consider implementing queue cleanup strategies",
      );
    }
    if (issues.length > 0) {
      this.logger.warn("⚠️ Performance Issues Detected", { issues });
      this.logger.info("💡 Recommendations", { recommendations });
    } else {
      this.logger.info("✅ No performance issues detected");
    }
  }
}
export function createPerformanceMonitor(
  config: PerformanceMonitorConfig,
): IPerformanceMonitor | null {
  if (!config.enablePerformanceTracking) {
    return null;
  }
  return new PerformanceMonitor(config);
}
export class NoOpPerformanceMonitor implements IPerformanceMonitor {
  start(): void {}
  stop(): void {}
  reset(): void {}
  getMetrics(): PerformanceMetrics {
    return {
      providerLoadTimes: new Map(),
      providerLoadAttempts: new Map(),
      providerLoadFailures: new Map(),
      batchProcessingTimes: [],
      totalEventsProcessed: 0,
      batchCount: 0,
      averageBatchSize: 0,
      maxQueueSize: 0,
      queueOverflows: 0,
      averageQueueSize: 0,
      contextCacheHits: 0,
      contextCacheMisses: 0,
      eventProcessingTimes: [],
      failedEvents: 0,
      retriedEvents: 0,
      activeTimers: 0,
      activePromises: 0,
      startTime: 0,
      lastMetricsReset: 0,
    };
  }
  trackProviderLoadStart(): void {}
  trackProviderLoadComplete(): void {}
  trackProviderLoadFailure(): void {}
  trackEventProcessingStart(): number {
    return 0;
  }
  trackEventProcessingComplete(): void {}
  trackEventProcessed(): void {}
  trackBatchProcessingStart(): number {
    return 0;
  }
  trackBatchProcessingComplete(): void {}
  trackQueueSize(): void {}
  trackQueueOverflow(): void {}
  trackContextCacheHit(): void {}
  trackContextCacheMiss(): void {}
  trackEventFailure(): void {}
  trackEventRetry(): void {}
  trackActiveTimer(): void {}
  trackActivePromise(): void {}
  logPerformanceMetrics(): void {}
}
