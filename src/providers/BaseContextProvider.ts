import type {
  IContextProvider,
  UTMParameters,
  IAnalyticsLogger,
} from "../types/IAnalyticsEvent";
import type { IStorageAdapter } from "../types/IAnalyticsEvent";
export abstract class BaseContextProvider implements IContextProvider {
  protected storageAdapter: IStorageAdapter;
  protected isInitialized = false;
  protected logger: IAnalyticsLogger;
  constructor(storageAdapter?: IStorageAdapter, logger?: IAnalyticsLogger) {
    this.storageAdapter = storageAdapter || new NoOpStorageAdapter();
    this.logger = logger || new NoOpLogger();
    this.initializeAndCache();
  }
  abstract getUTMParameters(): UTMParameters;
  abstract getCurrentUrl(): string;
  abstract getReferrer(): string;
  protected initializeAndCache(): void {
    if (this.isInitialized) return;
    try {
      const cachedData = this.storageAdapter.get("analytics_context");
      if (cachedData) {
        this.logger.debug("Loaded cached context data", cachedData);
      } else {
        this.cacheAllContextData();
      }
      this.isInitialized = true;
    } catch (error) {
      this.logger.warn("Failed to initialize context caching:", error);
      this.isInitialized = true;
    }
  }
  protected getCachedUTM(): UTMParameters | null {
    const cached = this.storageAdapter.get("utm_parameters");
    return cached as UTMParameters | null;
  }
  protected cacheUTM(utm: UTMParameters): void {
    this.storageAdapter.set("utm_parameters", utm);
  }
  protected cacheContextData(data: Record<string, unknown>): void {
    this.storageAdapter.set("analytics_context", data);
  }
  clearCache(): void {
    this.storageAdapter.clear();
  }
  isStorageEnabled(): boolean {
    return this.storageAdapter.isEnabled();
  }
  protected abstract cacheAllContextData(): void;
}
class NoOpStorageAdapter implements IStorageAdapter {
  set(): void {}
  get(): null {
    return null;
  }
  remove(): void {}
  clear(): void {}
  isEnabled(): boolean {
    return false;
  }
}
class NoOpLogger implements IAnalyticsLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
