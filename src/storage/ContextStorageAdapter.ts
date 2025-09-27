import type { UTMParameters } from "../types/IAnalyticsEvent";
import type { IAnalyticsLogger } from "../core/AnalyticsLogger";
import { NoOpAnalyticsLogger } from "../core/AnalyticsLogger";
export type StorageType = "session" | "local";
export interface CachedContextData {
  data: Record<string, unknown>;
  timestamp: number;
  expiresAt: number;
}
export type ContextData = {
  utm?: UTMParameters;
  globalProperties?: Record<string, unknown>;
  timestamp?: number;
  [key: string]: unknown;
};
export interface ContextStorageConfig {
  storageType: StorageType;
  cacheKey: string;
  ttl: number;
  enabled: boolean;
}
export interface IContextStorage {
  set(key: string, data: ContextData): void;
  get(key: string): ContextData | null;
  clear(key: string): void;
  isEnabled(): boolean;
}
const DEFAULT_CONFIG: ContextStorageConfig = {
  storageType: "session",
  cacheKey: "analytics_context_cache",
  ttl: 50 * 60 * 1000,
  enabled: true,
};
export class BrowserStorageAdapter implements IContextStorage {
  private config: ContextStorageConfig;
  private storage: Storage | null = null;
  private logger: IAnalyticsLogger;
  constructor(
    config?: Partial<ContextStorageConfig>,
    logger?: IAnalyticsLogger,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger || new NoOpAnalyticsLogger();
    this.initializeStorage();
  }
  private initializeStorage(): void {
    if (!this.config.enabled || typeof window === "undefined") {
      this.storage = null;
      return;
    }
    try {
      this.storage =
        this.config.storageType === "session"
          ? window.sessionStorage
          : window.localStorage;
    } catch (error) {
      this.logger.warn("Failed to initialize storage:", error);
      this.storage = null;
    }
  }
  set(key: string, data: ContextData): void {
    if (!this.storage || !this.config.enabled) return;
    try {
      const now = Date.now();
      const expiresAt = now + this.config.ttl;
      const cachedData: CachedContextData = {
        data,
        timestamp: now,
        expiresAt,
      };
      this.storage.setItem(key, JSON.stringify(cachedData));
    } catch (error) {
      this.logger.warn("Failed to cache context data:", error);
    }
  }
  get(key: string): ContextData | null {
    if (!this.storage || !this.config.enabled) return null;
    try {
      const cached = this.storage.getItem(key);
      if (!cached) return null;
      const cachedData: CachedContextData = JSON.parse(cached);
      const now = Date.now();
      if (now > cachedData.expiresAt) {
        this.clear(key);
        return null;
      }
      return cachedData.data;
    } catch (error) {
      this.logger.warn("Failed to retrieve cached context data:", error);
      this.clear(key);
      return null;
    }
  }
  clear(key: string): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(key);
    } catch (error) {
      this.logger.warn("Failed to clear cached context data:", error);
    }
  }
  isEnabled(): boolean {
    return this.config.enabled && this.storage !== null;
  }
  getConfig(): ContextStorageConfig {
    return { ...this.config };
  }
  updateConfig(newConfig: Partial<ContextStorageConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeStorage();
  }
}
export class MemoryStorageAdapter implements IContextStorage {
  private cache = new Map<string, CachedContextData>();
  private enabled: boolean;
  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }
  set(key: string, data: ContextData): void {
    if (!this.enabled) return;
    const now = Date.now();
    const expiresAt = now + DEFAULT_CONFIG.ttl;
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });
  }
  get(key: string): ContextData | null {
    if (!this.enabled) return null;
    const cached = this.cache.get(key);
    if (!cached) return null;
    const now = Date.now();
    if (now > cached.expiresAt) {
      this.clear(key);
      return null;
    }
    return cached.data;
  }
  clear(key: string): void {
    this.cache.delete(key);
  }
  isEnabled(): boolean {
    return this.enabled;
  }
  clearAll(): void {
    this.cache.clear();
  }
}
export class ContextStorageAdapter {
  private storage: IContextStorage;
  private config: ContextStorageConfig;
  private logger: IAnalyticsLogger;
  constructor(
    storage?: IContextStorage,
    config?: Partial<ContextStorageConfig>,
    logger?: IAnalyticsLogger,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger || new NoOpAnalyticsLogger();
    this.storage =
      storage || new BrowserStorageAdapter(this.config, this.logger);
  }
  set(data: ContextData): void {
    this.storage.set(this.config.cacheKey, data);
  }
  get(): ContextData | null {
    return this.storage.get(this.config.cacheKey);
  }
  clear(): void {
    this.storage.clear(this.config.cacheKey);
  }
  isEnabled(): boolean {
    return this.storage.isEnabled();
  }
  getConfig(): ContextStorageConfig {
    return { ...this.config };
  }
  updateConfig(newConfig: Partial<ContextStorageConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (this.storage instanceof BrowserStorageAdapter) {
      this.storage = new BrowserStorageAdapter(this.config, this.logger);
    }
  }
  getUTM(): UTMParameters | null {
    const data = this.get();
    return data?.utm || null;
  }
  getGlobalProperties(): Record<string, unknown> | null {
    const data = this.get();
    return data?.globalProperties || null;
  }
  getProperty<T>(key: string): T | null {
    const data = this.get();
    return (data?.[key] as T) || null;
  }
  setUTM(utm: UTMParameters): void {
    const existingData = this.get() || {};
    this.set({ ...existingData, utm });
  }
  setGlobalProperties(properties: Record<string, unknown>): void {
    const existingData = this.get() || {};
    this.set({ ...existingData, globalProperties: properties });
  }
  setProperty(key: string, value: unknown): void {
    const existingData = this.get() || {};
    this.set({ ...existingData, [key]: value });
  }
  static createBrowserStorage(
    config?: Partial<ContextStorageConfig>,
    logger?: IAnalyticsLogger,
  ): ContextStorageAdapter {
    return new ContextStorageAdapter(undefined, config, logger);
  }
  static createMemoryStorage(enabled: boolean = true): ContextStorageAdapter {
    return new ContextStorageAdapter(new MemoryStorageAdapter(enabled));
  }
  static createCustomStorage(
    storage: IContextStorage,
    config?: Partial<ContextStorageConfig>,
    logger?: IAnalyticsLogger,
  ): ContextStorageAdapter {
    return new ContextStorageAdapter(storage, config, logger);
  }
}
