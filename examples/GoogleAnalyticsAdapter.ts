import { BaseAnalyticsAdapter, IAnalyticsEvent, IAnalyticsLogger } from '../src';
export interface GoogleAnalyticsConfig {
  measurementId: string;
  debugMode?: boolean;
  sendPageView?: boolean;
}
export class GoogleAnalyticsAdapter extends BaseAnalyticsAdapter implements IAnalyticsEvent {
  private config: GoogleAnalyticsConfig;
  constructor(config: GoogleAnalyticsConfig, logger?: IAnalyticsLogger) {
    super(logger);
    this.config = config;
  }
  async load(callback?: () => void): Promise<void> {
    if (this.isLoaded) {
      callback?.();
      return;
    }
    if (typeof window === 'undefined') {
      callback?.();
      return;
    }
    try {
      await this.loadGoogleAnalyticsSDK();
      this.isLoaded = true;
      callback?.();
    } catch (error) {
      this.logger.error('Google Analytics load failed:', error);
      callback?.();
    }
  }
  init(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    try {
      (window as any).gtag('js', new Date());
      (window as any).gtag('config', this.config.measurementId, {
        debug_mode: this.config.debugMode,
        send_page_view: this.config.sendPageView,
      });
      this.isInitialized = true;
      this.logger.info('Google Analytics initialized successfully');
    } catch (error) {
      this.logger.error('Google Analytics init failed:', error);
    }
  }
  send<T>(eventName: string, options?: T): void {
    if (typeof window === 'undefined' || !(window as any).gtag) {
      this.logger.warn('Google Analytics not loaded, event not sent:', eventName);
      return;
    }
    try {
      if (options && typeof options === 'object' && options !== null) {
        (window as any).gtag('event', eventName, options);
      } else {
        (window as any).gtag('event', eventName);
      }
      this.logger.info('Event sent to Google Analytics:', { eventName, options });
    } catch (error) {
      this.logger.error('Google Analytics send failed:', error);
    }
  }
  setUserId(userId: string): void {
    if (typeof window === 'undefined' || !(window as any).gtag) {
      this.logger.warn('Google Analytics not loaded, user ID not set');
      return;
    }
    try {
      (window as any).gtag('config', this.config.measurementId, {
        user_id: userId,
      });
      this.logger.info('User ID set in Google Analytics:', userId);
    } catch (error) {
      this.logger.error('Google Analytics setUserId failed:', error);
    }
  }
  destroy(): void {
    super.destroy?.();
    this.logger.info('Google Analytics adapter destroyed');
  }
  private async loadGoogleAnalyticsSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.measurementId}`;
      script.async = true;
      script.onload = () => {
        (window as any).dataLayer = (window as any).dataLayer || [];
        (window as any).gtag = function(...args: unknown[]) {
          (window as any).dataLayer.push(args);
        };
        resolve();
      };
      script.onerror = () => {
        reject(new Error('Failed to load Google Analytics SDK'));
      };
      document.head.appendChild(script);
    });
  }
}
export function createGoogleAnalyticsAdapter(config: GoogleAnalyticsConfig, logger?: IAnalyticsLogger): GoogleAnalyticsAdapter {
  return new GoogleAnalyticsAdapter(config, logger);
}
