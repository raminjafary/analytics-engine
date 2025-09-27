declare global {
  interface Window {
    amplitude?: {
      init: (apiKey: string, options?: any) => void;
      track: (eventName: string, eventProperties?: Record<string, unknown>) => void;
      setUserId: (userId: string) => void;
    };
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}
export {};
