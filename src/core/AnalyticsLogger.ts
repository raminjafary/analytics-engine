export interface IAnalyticsLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}
export class NoOpAnalyticsLogger implements IAnalyticsLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
export class ConsoleAnalyticsLogger implements IAnalyticsLogger {
  private isDebugEnabled: boolean;
  constructor(debug: boolean = false) {
    this.isDebugEnabled = debug;
  }
  debug(message: string, data?: unknown): void {
    if (
      this.isDebugEnabled &&
      typeof console !== "undefined" &&
      console.debug
    ) {
      console.debug(
        `%c[Analytics Debug]%c ${message}`,
        "background: #6366f1; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;",
        "color: #fbbf24; font-size: 12px; font-weight: 500;",
        data,
      );
    }
  }
  info(message: string, data?: unknown): void {
    if (typeof console !== "undefined" && console.info) {
      console.info(
        `%c[Analytics Info]%c ${message}`,
        "background: #06b6d4; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;",
        "color: #fbbf24; font-size: 12px; font-weight: 500;",
        data,
      );
    }
  }
  warn(message: string, data?: unknown): void {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        `%c[Analytics Warn]%c ${message}`,
        "background: #f59e0b; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;",
        "color: #fbbf24; font-size: 12px; font-weight: 500;",
        data,
      );
    }
  }
  error(message: string, data?: unknown): void {
    if (typeof console !== "undefined" && console.error) {
      console.error(
        `%c[Analytics Error]%c ${message}`,
        "background: #ef4444; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;",
        "color: #fbbf24; font-size: 12px; font-weight: 500;",
        data,
      );
    }
  }
}
