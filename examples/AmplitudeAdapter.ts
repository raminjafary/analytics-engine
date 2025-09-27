import { BaseAnalyticsAdapter, IAnalyticsEvent, IAnalyticsLogger } from '../src';
export interface AmplitudeConfig {
  apiKey: string;
  options?: {
    defaultTracking?: {
      sessions?: boolean;
      attribution?: boolean;
    };
    autocapture?: {
      pageViews?: boolean;
      elementInteractions?: boolean;
    };
  };
}
export class AmplitudeAdapter extends BaseAnalyticsAdapter implements IAnalyticsEvent {
  private config: AmplitudeConfig;
  constructor(config: AmplitudeConfig, logger?: IAnalyticsLogger) {
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
      await this.loadAmplitudeSDK();
      this.isLoaded = true;
      callback?.();
    } catch (error) {
      this.logger.error('Amplitude load failed:', error);
      callback?.();
    }
  }
  init(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    try {
      (window as any).amplitude?.init(this.config.apiKey, this.config.options);
      this.isInitialized = true;
      this.logger.info('Amplitude initialized successfully');
    } catch (error) {
      this.logger.error('Amplitude init failed:', error);
    }
  }
  send<T>(eventName: string, options?: T): void {
    if (typeof window === 'undefined' || !(window as any).amplitude) {
      this.logger.warn('Amplitude not loaded, event not sent:', eventName);
      return;
    }
    try {
      (window as any).amplitude.track(eventName, options);
      this.logger.info('Event sent to Amplitude:', { eventName, options });
    } catch (error) {
      this.logger.error('Amplitude send failed:', error);
    }
  }
  setUserId(userId: string): void {
    if (typeof window === 'undefined' || !(window as any).amplitude) {
      this.logger.warn('Amplitude not loaded, user ID not set');
      return;
    }
    try {
      (window as any).amplitude.setUserId(userId);
      this.logger.info('User ID set in Amplitude:', userId);
    } catch (error) {
      this.logger.error('Amplitude setUserId failed:', error);
    }
  }
  destroy(): void {
    super.destroy?.();
    this.logger.info('Amplitude adapter destroyed');
  }
  private async loadAmplitudeSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.amplitude.com/libs/amplitude-8.21.0-min.gz.js',
      script.async = true;
      script.onload = () => {
        (window as any).amplitude = (window as any).amplitude || {};
        resolve();
      };
      script.onerror = () => {
        reject(new Error('Failed to load Amplitude SDK'));
      };
      document.head.appendChild(script);
    });
  }
}
export function createAmplitudeAdapter(config: AmplitudeConfig, logger?: IAnalyticsLogger): AmplitudeAdapter {
  return new AmplitudeAdapter(config, logger);
}
