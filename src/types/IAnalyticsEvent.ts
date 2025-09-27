export interface IAnalyticsEvent {
  load(callback?: () => void): void;
  init(): void;
  send<T>(eventName: string, options?: T): void;
  setUserId?(userId: string): void;
  destroy?(): void;
}
export interface IContextProvider {
  getUTMParameters(): UTMParameters;
  getCurrentUrl(): string;
  getReferrer(): string;
}
export interface IStorageAdapter {
  set(key: string, data: unknown): void;
  get(key: string): unknown | null;
  remove(key: string): void;
  clear(): void;
  isEnabled(): boolean;
}
export interface UTMParameters {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_id?: string;
  utm_term?: string;
  utm_content?: string;
  url?: string;
  referrer?: string;
  [key: string]: unknown;
}
export interface IAnalyticsLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}
export interface AnalyticsEngineConfig {
  maxQueueSize?: number;
  maxRetries?: number;
  batchSize?: number;
  batchTimeout?: number;
  lazyLoading?: boolean;
  maxProviderQueueSize?: number;
  eagerProviders?: string[];
  enableSmartDequeue?: boolean;
  maxSentEventsToKeep?: number;
  contextCacheTimeout?: number;
  debug?: boolean;
  logger?: IAnalyticsLogger;
}
export interface ProviderConfig {
  name: string;
  provider: IAnalyticsEvent;
  enabled: boolean;
  state: ProviderState;
  retryCount: number;
  maxRetries: number;
}
export enum ProviderState {
  UNINITIALIZED = "uninitialized",
  LOADING = "loading",
  READY = "ready",
  ERROR = "error",
}
export interface QueuedEvent<T = Record<string, unknown>> {
  eventName: string;
  options?: T;
  timestamp: number;
  targetProviders?: string[];
  excludeProviders?: string[];
  providerTypes?: string[];
}
export interface IComprehensiveAnalyticsEvent extends IAnalyticsEvent {
  addProvider(
    provider: IAnalyticsEvent,
    name?: string,
    config?: Partial<ProviderConfig>,
  ): void;
  removeProvider(providerName: string): void;
  enableProvider(providerName: string): void;
  disableProvider(providerName: string): void;
  getProviders(): string[];
  getEnabledProviders(): string[];
  getProviderByType(providerType: string): string | undefined;
  isProviderReady(providerName: string): boolean;
  getReadyProviders(): string[];
  getProviderState(providerName: string): ProviderState;
  sendToProviders<T>(
    eventName: string,
    targetProviders: string[],
    options?: T,
  ): void;
  sendToProviderTypes<T>(
    eventName: string,
    providerTypes: string[],
    options?: T,
  ): void;
  sendToAllExcept<T>(
    eventName: string,
    excludeProviders: string[],
    options?: T,
  ): void;
  setGlobalProperties(properties: Record<string, unknown>): void;
  setContextProvider(provider: IContextProvider): void;
  getQueueSize(): number;
  flushQueue(): void;
  clearQueue(): void;
  reset(): void;
  destroy(): void;
  getProviderStats?(): {
    total: number;
    ready: number;
    loading: number;
    error: number;
    uninitialized: number;
    queueSizes: Record<string, number>;
    isLazyLoading: boolean;
  };
}
