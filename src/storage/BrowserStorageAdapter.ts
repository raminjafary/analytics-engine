import { BaseStorageAdapter } from "./BaseStorageAdapter";
import type { IAnalyticsLogger } from "../types/IAnalyticsEvent";
export interface BrowserStorageConfig {
  storageType: "localStorage" | "sessionStorage";
  enabled: boolean;
}
export class BrowserStorageAdapter extends BaseStorageAdapter {
  private config: BrowserStorageConfig;
  private storage: Storage | null = null;
  constructor(
    config: Partial<BrowserStorageConfig> = {},
    logger?: IAnalyticsLogger,
  ) {
    super(config.enabled !== false, logger);
    this.config = {
      storageType: "sessionStorage",
      enabled: true,
      ...config,
    };
    this.initializeStorage();
  }
  set(key: string, data: unknown): void {
    if (!this.storage || !this.enabled) return;
    try {
      this.storage.setItem(key, JSON.stringify(data));
    } catch (error) {
      this.logError("set", error);
    }
  }
  get(key: string): unknown | null {
    if (!this.storage || !this.enabled) return null;
    try {
      const item = this.storage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      this.logError("get", error);
      return null;
    }
  }
  remove(key: string): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(key);
    } catch (error) {
      this.logError("remove", error);
    }
  }
  clear(): void {
    if (!this.storage) return;
    try {
      this.storage.clear();
    } catch (error) {
      this.logError("clear", error);
    }
  }
  private initializeStorage(): void {
    if (!this.enabled || typeof window === "undefined") {
      this.storage = null;
      return;
    }
    try {
      this.storage =
        this.config.storageType === "sessionStorage"
          ? window.sessionStorage
          : window.localStorage;
    } catch (error) {
      this.logError("initialize", error);
      this.storage = null;
    }
  }
}
