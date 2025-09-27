import type {
  IAnalyticsEvent,
  IComprehensiveAnalyticsEvent,
  ProviderConfig,
  QueuedEvent,
  IContextProvider,
  UTMParameters,
  AnalyticsEngineConfig,
} from "../types/IAnalyticsEvent";
import { ProviderState } from "../types/IAnalyticsEvent";
import type {
  IPerformanceMonitor,
  PerformanceMetrics,
  ProviderStats,
} from "./PerformanceMonitor";
import { NoOpPerformanceMonitor } from "./PerformanceMonitor";
import type { IAnalyticsLogger } from "./AnalyticsLogger";
import { NoOpAnalyticsLogger, ConsoleAnalyticsLogger } from "./AnalyticsLogger";
const DEFAULT_CONFIG: AnalyticsEngineConfig = {
  maxQueueSize: 1000,
  maxRetries: 3,
  batchSize: 10,
  batchTimeout: 2000,
  lazyLoading: true,
  maxProviderQueueSize: 500,
  eagerProviders: [],
  enableSmartDequeue: true,
  maxSentEventsToKeep: 50,
  debug: false,
  logger: new NoOpAnalyticsLogger(),
};
interface ProviderQueue {
  events: QueuedEvent[];
  sentEvents: QueuedEvent[];
  isLoading: boolean;
  lastActivity: number;
}
export class AnalyticsEngine implements IComprehensiveAnalyticsEvent {
  private providers = new Map<string, ProviderConfig>();
  private providerQueues = new Map<string, ProviderQueue>();
  private globalQueue: QueuedEvent[] = [];
  private globalSentEvents: QueuedEvent[] = [];
  private globalProperties: Record<string, unknown> = {};
  private contextProvider?: IContextProvider;
  private config: AnalyticsEngineConfig;
  private batchTimeout: NodeJS.Timeout | null = null;
  private isDestroyed = false;
  private loadingPromises = new Map<string, Promise<void>>();
  private performanceMonitor: IPerformanceMonitor;
  private logger: IAnalyticsLogger;
  constructor(
    config?: Partial<AnalyticsEngineConfig>,
    performanceMonitor: IPerformanceMonitor | null = null,
    logger: IAnalyticsLogger | null = null,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.performanceMonitor =
      performanceMonitor ?? new NoOpPerformanceMonitor();
    this.logger = logger ?? new NoOpAnalyticsLogger();
    this.setupLogger();
    this.performanceMonitor.start();
    this.logger.info("AnalyticsEngine initialized", { config: this.config });
  }
  private setupLogger(): void {
    try {
      if (this.config.logger) {
        this.logger = this.config.logger;
      } else if (this.config.debug !== undefined) {
        this.logger = new ConsoleAnalyticsLogger(this.config.debug);
      } else {
        this.logger = new NoOpAnalyticsLogger();
      }
    } catch (error) {
      this.logger = new NoOpAnalyticsLogger();
      this.logger.error(
        "[AnalyticsEngine] Failed to setup logger, using no-op logger:",
        error,
      );
    }
  }
  load(callback?: () => void): void {
    if (this.config.lazyLoading) {
      this.loadEagerProviders(callback);
    } else {
      this.loadAllProviders(callback);
    }
  }
  init(): void {
    if (this.isDestroyed) return;
    this.providers.forEach(({ provider, state }) => {
      if (state === ProviderState.READY) {
        provider.init?.();
      }
    });
  }
  send<T>(eventName: string, options?: T): void {
    if (this.isDestroyed) return;
    const event: QueuedEvent = {
      eventName,
      options: options as Record<string, unknown>,
      timestamp: Date.now(),
    };
    this.enqueueEvent(event);
  }
  setUserId(userId: string): void {
    if (this.isDestroyed) return;
    this.providers.forEach(({ provider, state }) => {
      if (state === ProviderState.READY && provider.setUserId) {
        provider.setUserId(userId);
      }
    });
    this.setGlobalProperties({ userId });
  }
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.performanceMonitor.stop();
    this.clearAllTimers();
    this.providers.forEach(({ provider }) => {
      provider.destroy?.();
    });
    this.providers.clear();
    this.providerQueues.clear();
    this.clearAllQueues();
    this.globalProperties = {};
    this.loadingPromises.clear();
  }
  addProvider(
    provider: IAnalyticsEvent,
    name?: string,
    config?: Partial<ProviderConfig>,
  ): void {
    if (this.isDestroyed) return;
    const providerName = name || `provider_${this.providers.size}`;
    const providerConfig: ProviderConfig = {
      name: providerName,
      provider,
      enabled: true,
      state: ProviderState.UNINITIALIZED,
      retryCount: 0,
      maxRetries: this.config.maxRetries ?? 3,
      ...config,
    };
    this.providers.set(providerName, providerConfig);
    this.providerQueues.set(providerName, {
      events: [],
      sentEvents: [],
      isLoading: false,
      lastActivity: Date.now(),
    });
    if (
      !this.config.lazyLoading ||
      (name && this.config.eagerProviders?.includes(name))
    ) {
      this.loadProvider(providerName, provider).catch((error) => {
        this.logger.error(`Failed to load provider ${providerName}:`, error);
      });
    }
  }
  removeProvider(providerName: string): void {
    const config = this.providers.get(providerName);
    if (config) {
      config.provider.destroy?.();
      this.providers.delete(providerName);
      this.providerQueues.delete(providerName);
      this.loadingPromises.delete(providerName);
    }
  }
  enableProvider(providerName: string): void {
    const config = this.providers.get(providerName);
    if (config) config.enabled = true;
  }
  disableProvider(providerName: string): void {
    const config = this.providers.get(providerName);
    if (config) config.enabled = false;
  }
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }
  getEnabledProviders(): string[] {
    return Array.from(this.providers.values())
      .filter((p) => p.enabled)
      .map((p) => p.name);
  }
  getProviderByType(providerType: string): string | undefined {
    return Array.from(this.providers.keys()).find((name) =>
      name.includes(providerType),
    );
  }
  isProviderReady(providerName: string): boolean {
    return this.providers.get(providerName)?.state === ProviderState.READY;
  }
  getReadyProviders(): string[] {
    return Array.from(this.providers.values())
      .filter((p) => p.state === ProviderState.READY)
      .map((p) => p.name);
  }
  getProviderState(providerName: string): ProviderState {
    return (
      this.providers.get(providerName)?.state ?? ProviderState.UNINITIALIZED
    );
  }
  sendToProviders<T>(
    eventName: string,
    targetProviders: string[],
    options?: T,
  ): void {
    if (this.isDestroyed) return;
    const event: QueuedEvent = {
      eventName,
      options: options as Record<string, unknown>,
      timestamp: Date.now(),
      targetProviders,
    };
    this.enqueueEvent(event);
  }
  sendToProviderTypes<T>(
    eventName: string,
    providerTypes: string[],
    options?: T,
  ): void {
    if (this.isDestroyed) return;
    const event: QueuedEvent = {
      eventName,
      options: options as Record<string, unknown>,
      timestamp: Date.now(),
      providerTypes,
    };
    this.enqueueEvent(event);
  }
  sendToAllExcept<T>(
    eventName: string,
    excludeProviders: string[],
    options?: T,
  ): void {
    if (this.isDestroyed) return;
    const event: QueuedEvent = {
      eventName,
      options: options as Record<string, unknown>,
      timestamp: Date.now(),
      excludeProviders,
    };
    this.enqueueEvent(event);
  }
  setGlobalProperties(properties: Record<string, unknown>): void {
    if (this.isDestroyed) return;
    Object.assign(this.globalProperties, properties);
  }
  setContextProvider(provider: IContextProvider): void {
    this.contextProvider = provider;
  }
  getQueueSize(): number {
    const providerQueueSizes = Array.from(this.providerQueues.values()).reduce(
      (total, queue) => total + queue.events.length,
      0,
    );
    return this.globalQueue.length + providerQueueSizes;
  }
  flushQueue(): void {
    if (this.isDestroyed) return;
    this.flushGlobalQueue();
    this.flushProviderQueues();
  }
  clearQueue(): void {
    this.clearAllQueues();
  }
  reset(): void {
    if (this.isDestroyed) return;
    this.clearAllQueues();
    this.clearAllTimers();
    this.providers.forEach((config) => {
      config.state = ProviderState.UNINITIALIZED;
      config.retryCount = 0;
    });
    this.providerQueues.forEach((queue) => {
      queue.isLoading = false;
      queue.events = [];
      queue.sentEvents = [];
    });
    this.globalSentEvents = [];
    this.loadingPromises.clear();
    this.performanceMonitor.reset();
  }
  getProviderStats(): ProviderStats {
    const stats: ProviderStats = {
      total: this.providers.size,
      ready: 0,
      loading: 0,
      error: 0,
      uninitialized: 0,
      queueSizes: {} as Record<string, number>,
      isLazyLoading: this.config.lazyLoading ?? true,
    };
    this.providers.forEach((config, name) => {
      switch (config.state) {
        case ProviderState.READY:
          stats.ready++;
          break;
        case ProviderState.LOADING:
          stats.loading++;
          break;
        case ProviderState.ERROR:
          stats.error++;
          break;
        case ProviderState.UNINITIALIZED:
          stats.uninitialized++;
          break;
      }
      const queue = this.providerQueues.get(name);
      stats.queueSizes[name] = queue?.events.length || 0;
    });
    return stats;
  }
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }
  resetPerformanceMetrics(): void {
    this.performanceMonitor.reset();
  }
  logPerformanceMetrics(): void {
    const providerStats = this.getProviderStats();
    this.performanceMonitor.logPerformanceMetrics(providerStats);
  }
  private enqueueEvent(event: QueuedEvent): void {
    const startTime = this.performanceMonitor.trackEventProcessingStart();
    if (this.globalQueue.length >= (this.config.maxQueueSize ?? 1000)) {
      this.makeRoomInGlobalQueue();
    }
    const targetProviders = this.getTargetProviders(event);
    targetProviders.forEach((providerName) => {
      const config = this.providers.get(providerName);
      if (!config?.enabled) return;
      if (config.state === ProviderState.READY) {
        this.sendEventToProvider(event, providerName);
      } else {
        this.queueEventForProvider(event, providerName);
        if (
          this.config.lazyLoading &&
          config.state === ProviderState.UNINITIALIZED
        ) {
          this.loadProvider(providerName, config.provider).catch((error) => {
            this.logger.error(
              `Failed to load provider ${providerName}:`,
              error,
            );
          });
        }
      }
    });
    this.performanceMonitor.trackEventProcessingComplete(startTime);
    this.flushReadyProviders();
    this.scheduleBatchProcessing();
  }
  private queueEventForProvider(
    event: QueuedEvent,
    providerName: string,
  ): void {
    const queue = this.providerQueues.get(providerName);
    if (!queue) return;
    if (queue.events.length >= (this.config.maxProviderQueueSize ?? 500)) {
      if (!this.makeRoomInProviderQueue(queue, providerName)) {
        this.logger.error(
          `Cannot queue event for ${providerName} - all strategies exhausted`,
        );
        this.performanceMonitor.trackEventFailure();
        return;
      }
    }
    queue.events.push(event);
    queue.lastActivity = Date.now();
    this.performanceMonitor.trackQueueSize(this.getQueueSize());
  }
  private makeRoomInProviderQueue(
    queue: ProviderQueue,
    providerName: string,
  ): boolean {
    if (!this.config.enableSmartDequeue) {
      this.logger.warn(
        `Queue full for ${providerName} but smart dequeue is disabled`,
      );
      return false;
    }
    if (queue.sentEvents.length > (this.config.maxSentEventsToKeep ?? 50)) {
      const eventsToRemove =
        queue.sentEvents.length - (this.config.maxSentEventsToKeep ?? 50);
      queue.sentEvents.splice(0, eventsToRemove);
      this.logger.debug(
        `Cleaned up ${eventsToRemove} old sent events for ${providerName}`,
      );
    }
    const availableSpace =
      (this.config.maxProviderQueueSize ?? 500) - queue.events.length;
    if (availableSpace > 0) {
      return true;
    }
    this.logger.warn(
      `Provider ${providerName} queue still full after cleanup. This indicates high event volume or slow provider.`,
    );
    return false;
  }
  private makeRoomInGlobalQueue(): void {
    if (!this.config.enableSmartDequeue) {
      return;
    }
    if (
      this.globalSentEvents.length > (this.config.maxSentEventsToKeep ?? 50)
    ) {
      const eventsToRemove =
        this.globalSentEvents.length - (this.config.maxSentEventsToKeep ?? 50);
      this.globalSentEvents.splice(0, eventsToRemove);
      this.logger.debug(
        `Aggressively cleaned ${eventsToRemove} old sent events from global history`,
      );
    }
    if (this.globalQueue.length >= (this.config.maxQueueSize ?? 1000)) {
      const eventsToRemove = Math.min(
        this.globalQueue.length -
          Math.floor((this.config.maxQueueSize ?? 1000) * 0.8),
        Math.floor((this.config.maxQueueSize ?? 1000) * 0.2),
      );
      if (eventsToRemove > 0) {
        const removedEvents = this.globalQueue.splice(0, eventsToRemove);
        this.logger.warn(
          `Had to remove ${eventsToRemove} oldest unsent events - consider increasing maxQueueSize`,
        );
        this.globalSentEvents.push(
          ...removedEvents.map(
            (event) =>
              ({
                ...event,
                timestamp: Date.now(),
                droppedFromQueue: true,
              }) as QueuedEvent,
          ),
        );
        if (
          this.globalSentEvents.length > (this.config.maxSentEventsToKeep ?? 50)
        ) {
          const excess =
            this.globalSentEvents.length -
            (this.config.maxSentEventsToKeep ?? 50);
          this.globalSentEvents.splice(0, excess);
          this.logger.debug(
            `Trimmed ${excess} events from global sent history to prevent memory bloat`,
          );
        }
      }
    }
  }
  private getTargetProviders(event: QueuedEvent): string[] {
    if (event.targetProviders) {
      return event.targetProviders;
    } else if (event.providerTypes) {
      return Array.from(this.providers.keys()).filter((name) =>
        event.providerTypes!.some((type) => name.includes(type)),
      );
    } else if (event.excludeProviders) {
      return Array.from(this.providers.keys()).filter(
        (name) => !event.excludeProviders!.includes(name),
      );
    } else {
      return this.getEnabledProviders();
    }
  }
  private sendEventToProvider(event: QueuedEvent, providerName: string): void {
    const config = this.providers.get(providerName);
    if (!config?.enabled || config.state !== ProviderState.READY) return;
    const queue = this.providerQueues.get(providerName);
    const mergedOptions = this.mergeEventProperties(event.options);
    try {
      config.provider.send(event.eventName, mergedOptions);
      this.performanceMonitor.trackEventProcessed();
      if (queue && this.config.enableSmartDequeue) {
        queue.sentEvents.push({
          ...event,
          timestamp: Date.now(),
        });
        if (queue.sentEvents.length > (this.config.maxSentEventsToKeep ?? 50)) {
          const excess =
            queue.sentEvents.length - (this.config.maxSentEventsToKeep ?? 50);
          queue.sentEvents.splice(0, excess);
          this.logger.debug(
            `Immediate cleanup: removed ${excess} sent events for ${providerName}`,
          );
        }
      }
    } catch (error) {
      this.performanceMonitor.trackEventFailure();
      this.logger.error(
        `Error sending event to provider ${providerName}:`,
        error,
      );
    }
  }
  private loadEagerProviders(callback?: () => void): void {
    const eagerProviderNames = Array.from(this.providers.entries())
      .filter(([name]) =>
        this.config.eagerProviders?.some((providerType) =>
          name.includes(providerType),
        ),
      )
      .map(([name]) => name);
    if (eagerProviderNames.length > 0) {
      const loadPromises = eagerProviderNames.map((name) => {
        const config = this.providers.get(name);
        return config
          ? this.loadProvider(name, config.provider)
          : Promise.resolve();
      });
      Promise.allSettled(loadPromises).then(() => {
        this.flushGlobalQueue();
        callback?.();
      });
    } else {
      callback?.();
    }
  }
  private loadAllProviders(callback?: () => void): void {
    const loadPromises = Array.from(this.providers.values()).map(
      ({ name, provider }) => this.loadProvider(name, provider),
    );
    Promise.allSettled(loadPromises).then(() => {
      this.flushGlobalQueue();
      callback?.();
    });
  }
  private async loadProvider(
    name: string,
    provider: IAnalyticsEvent,
  ): Promise<void> {
    const config = this.providers.get(name);
    const queue = this.providerQueues.get(name);
    if (!config || !queue || config.state === ProviderState.READY) return;
    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name);
    }
    this.performanceMonitor.trackProviderLoadStart(name);
    config.state = ProviderState.LOADING;
    queue.isLoading = true;
    const loadStartTime = performance.now();
    const loadPromise = new Promise<void>((resolve, reject) => {
      try {
        provider.load(() => {
          config.state = ProviderState.READY;
          queue.isLoading = false;
          const loadTime = performance.now() - loadStartTime;
          this.performanceMonitor.trackProviderLoadComplete(name, loadTime);
          provider.init?.();
          const userId = this.globalProperties.userId as string;
          if (userId && provider.setUserId) {
            provider.setUserId(userId);
          }
          this.replayProviderEvents(name);
          this.logger.info(
            `Provider ${name} is ready, aggressively flushing all pending events`,
          );
          this.flushReadyProviders();
          resolve();
        });
      } catch (error) {
        this.handleProviderError(name, error);
        reject(error);
      }
    });
    this.loadingPromises.set(name, loadPromise);
    return loadPromise;
  }
  private replayProviderEvents(providerName: string): void {
    const queue = this.providerQueues.get(providerName);
    if (!queue || queue.events.length === 0) return;
    const events = [...queue.events];
    queue.events = [];
    events.forEach((event) => {
      this.sendEventToProvider(event, providerName);
    });
  }
  private handleProviderError(name: string, error: unknown): void {
    const config = this.providers.get(name);
    const queue = this.providerQueues.get(name);
    if (!config || !queue) return;
    this.performanceMonitor.trackProviderLoadFailure(name);
    config.retryCount++;
    queue.isLoading = false;
    if (config.retryCount < config.maxRetries) {
      this.performanceMonitor.trackEventRetry();
      const delay = Math.pow(2, config.retryCount) * 1000;
      setTimeout(() => {
        config.state = ProviderState.UNINITIALIZED;
        this.loadingPromises.delete(name);
        this.loadProvider(name, config.provider).catch((error) => {
          this.logger.error(`Failed to retry load provider ${name}:`, error);
        });
      }, delay);
    } else {
      config.state = ProviderState.ERROR;
      this.logger.error(
        `Analytics provider ${name} failed after ${config.maxRetries} retries:`,
        error,
      );
    }
  }
  private mergeEventProperties(
    options?: Record<string, unknown>,
  ): Record<string, unknown> {
    const contextData = this.getContextData();
    return {
      ...this.globalProperties,
      ...contextData,
      ...options,
    };
  }
  private getContextData(): UTMParameters {
    return this.contextProvider?.getUTMParameters() ?? {};
  }
  private flushGlobalQueue(): void {
    if (this.globalQueue.length === 0) return;
    const batchStartTime = this.performanceMonitor.trackBatchProcessingStart();
    const batch = this.globalQueue.splice(0, this.config.batchSize);
    batch.forEach((event) => {
      this.enqueueEvent(event);
    });
    this.performanceMonitor.trackBatchProcessingComplete(
      batchStartTime,
      batch.length,
    );
    this.flushReadyProviders();
    if (this.globalQueue.length > 0) {
      setTimeout(() => this.flushGlobalQueue(), 0);
    }
  }
  private flushProviderQueues(): void {
    this.providerQueues.forEach((queue, providerName) => {
      if (queue.events.length > 0 && this.isProviderReady(providerName)) {
        this.replayProviderEvents(providerName);
      }
    });
  }
  private flushReadyProviders(): void {
    this.providerQueues.forEach((queue, providerName) => {
      if (queue.events.length > 0 && this.isProviderReady(providerName)) {
        this.logger.info(
          `🚀 Aggressively flushing ${queue.events.length} events for ready provider ${providerName}`,
        );
        this.replayProviderEvents(providerName);
        this.cleanupSentEvents(queue, providerName);
      }
    });
  }
  private cleanupSentEvents(queue: ProviderQueue, providerName: string): void {
    if (!this.config.enableSmartDequeue) return;
    if (queue.sentEvents.length > (this.config.maxSentEventsToKeep ?? 50)) {
      const eventsToRemove =
        queue.sentEvents.length - (this.config.maxSentEventsToKeep ?? 50);
      queue.sentEvents.splice(0, eventsToRemove);
      this.logger.debug(
        `🧹 Immediately cleaned ${eventsToRemove} sent events for ${providerName}`,
      );
    }
  }
  private clearAllQueues(): void {
    this.globalQueue = [];
    this.globalSentEvents = [];
    this.providerQueues.forEach((queue) => {
      queue.events = [];
      queue.sentEvents = [];
    });
  }
  private scheduleBatchProcessing(): void {
    if (this.batchTimeout) return;
    this.performanceMonitor.trackActiveTimer(true);
    const aggressiveTimeout = Math.min(this.config.batchTimeout ?? 2000, 500);
    this.batchTimeout = setTimeout(() => {
      this.flushQueue();
      this.flushReadyProviders();
      this.batchTimeout = null;
      this.performanceMonitor.trackActiveTimer(false);
      if (this.getQueueSize() > 0) {
        this.logger.info(
          `📦 Still ${this.getQueueSize()} events queued, scheduling immediate next batch`,
        );
        this.scheduleBatchProcessing();
      }
    }, aggressiveTimeout);
  }
  private clearAllTimers(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
  loadSelectedProviders(
    providers: string[],
    callback?: () => void,
  ): Promise<void> {
    if (this.isDestroyed) {
      callback?.();
      return Promise.resolve();
    }
    const providerNames = providers
      .map((provider) => {
        if (typeof provider === "string") {
          return provider;
        }
        return this.getProviderByType(provider);
      })
      .filter((name): name is string => name !== undefined);
    if (providerNames.length === 0) {
      this.logger.warn("No valid providers found to load");
      callback?.();
      return Promise.resolve();
    }
    const providersToLoad = providerNames.filter((name) => {
      const config = this.providers.get(name);
      return config && config.state === ProviderState.UNINITIALIZED;
    });
    if (providersToLoad.length === 0) {
      this.logger.info("All specified providers are already loaded or loading");
      callback?.();
      return Promise.resolve();
    }
    this.logger.info(
      `Loading ${providersToLoad.length} selected providers: ${providersToLoad.join(", ")}`,
    );
    const loadPromises = providersToLoad.map((name) => {
      const config = this.providers.get(name);
      if (!config) {
        this.logger.warn(`Provider ${name} not found`);
        return Promise.resolve();
      }
      return this.loadProvider(name, config.provider).catch((error) => {
        this.logger.error(`Failed to load provider ${name}:`, error);
        return Promise.resolve();
      });
    });
    return Promise.allSettled(loadPromises).then((results) => {
      const successful = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failed = results.filter(
        (result) => result.status === "rejected",
      ).length;
      this.logger.info(
        `Provider loading completed: ${successful} successful, ${failed} failed`,
      );
      this.flushGlobalQueue();
      callback?.();
    });
  }
}
