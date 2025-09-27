import type {
  IAnalyticsEvent,
  IAnalyticsLogger,
} from "../types/IAnalyticsEvent";
export abstract class BaseAnalyticsAdapter implements IAnalyticsEvent {
  protected logger: IAnalyticsLogger;
  protected isLoaded = false;
  protected isInitialized = false;
  constructor(logger?: IAnalyticsLogger) {
    this.logger = logger || new NoOpLogger();
  }
  abstract load(callback?: () => void): void;
  abstract init(): void;
  abstract send<T>(eventName: string, options?: T): void;
  abstract setUserId?(userId: string): void;
  destroy?(): void {
    this.isLoaded = false;
    this.isInitialized = false;
  }
  protected logError(operation: string, error: unknown): void {
    this.logger.error(`Analytics adapter ${operation} failed:`, error);
  }
  protected logInfo(message: string, data?: unknown): void {
    this.logger.info(message, data);
  }
}
class NoOpLogger implements IAnalyticsLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
