import type {
  IStorageAdapter,
  IAnalyticsLogger,
} from "../types/IAnalyticsEvent";
export abstract class BaseStorageAdapter implements IStorageAdapter {
  protected logger: IAnalyticsLogger;
  protected enabled: boolean;
  constructor(enabled: boolean = true, logger?: IAnalyticsLogger) {
    this.enabled = enabled;
    this.logger = logger || new NoOpLogger();
  }
  abstract set(key: string, data: unknown): void;
  abstract get(key: string): unknown | null;
  abstract remove(key: string): void;
  abstract clear(): void;
  isEnabled(): boolean {
    return this.enabled;
  }
  protected logError(operation: string, error: unknown): void {
    this.logger.error(`Storage ${operation} failed:`, error);
  }
}
export class NoOpStorageAdapter implements IStorageAdapter {
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
