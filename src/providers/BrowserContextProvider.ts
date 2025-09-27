import { BaseContextProvider } from "./BaseContextProvider";
import type {
  UTMParameters,
  IAnalyticsLogger,
  IStorageAdapter,
} from "../types/IAnalyticsEvent";
export class BrowserContextProvider extends BaseContextProvider {
  private static instance: BrowserContextProvider | null = null;
  private constructor(
    storageAdapter?: IStorageAdapter,
    logger?: IAnalyticsLogger,
  ) {
    super(storageAdapter, logger);
  }
  static getInstance(
    storageAdapter?: IStorageAdapter,
    logger?: IAnalyticsLogger,
  ): BrowserContextProvider {
    if (!BrowserContextProvider.instance) {
      BrowserContextProvider.instance = new BrowserContextProvider(
        storageAdapter,
        logger,
      );
    }
    return BrowserContextProvider.instance;
  }
  static resetInstance(): void {
    BrowserContextProvider.instance = null;
  }
  getUTMParameters(): UTMParameters {
    const urlUTM = this.generateUTMParameters();
    const cached = this.getCachedUTM();
    const mergedUTM = this.mergeURLWithCachedUTM(urlUTM, cached);
    this.cacheUTM(mergedUTM);
    this.logger.debug("Merged UTM parameters from URL and cache", mergedUTM);
    return mergedUTM;
  }
  getCurrentUrl(): string {
    return typeof window !== "undefined" ? window.location.href : "";
  }
  getReferrer(): string {
    return typeof document !== "undefined" ? document.referrer : "";
  }
  protected cacheAllContextData(): void {
    if (typeof window === "undefined") return;
    const utm = this.generateUTMParameters();
    const contextData = {
      utm,
      timestamp: Date.now(),
    };
    this.cacheContextData(contextData);
    this.logger.debug("Cached all browser context data", contextData);
  }
  private generateUTMParameters(): UTMParameters {
    if (typeof window === "undefined") return {};
    const url = new URL(window.location.href);
    const params = url.searchParams;
    return {
      utm_source: params.get("utm_source") || undefined,
      utm_medium: params.get("utm_medium") || undefined,
      utm_campaign: params.get("utm_campaign") || undefined,
      utm_id: params.get("utm_id") || undefined,
      utm_term: params.get("utm_term") || undefined,
      utm_content: params.get("utm_content") || undefined,
      url: window.location.href,
      referrer: document.referrer || "",
    };
  }
  private mergeURLWithCachedUTM(
    urlUTM: UTMParameters,
    cachedUTM: UTMParameters | null,
  ): UTMParameters {
    if (!cachedUTM) return urlUTM;
    const merged: UTMParameters = { ...cachedUTM };
    if (urlUTM.utm_source) merged.utm_source = urlUTM.utm_source;
    if (urlUTM.utm_medium) merged.utm_medium = urlUTM.utm_medium;
    if (urlUTM.utm_campaign) merged.utm_campaign = urlUTM.utm_campaign;
    if (urlUTM.utm_id) merged.utm_id = urlUTM.utm_id;
    if (urlUTM.utm_term) merged.utm_term = urlUTM.utm_term;
    if (urlUTM.utm_content) merged.utm_content = urlUTM.utm_content;
    merged.url = urlUTM.url || merged.url;
    merged.referrer = urlUTM.referrer || merged.referrer;
    return merged;
  }
}
