import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BrowserContextProvider } from "../src/providers/BrowserContextProvider";
interface MockWindow {
  location: {
    href: string;
    search: string;
  };
}
interface MockDocument {
  referrer: string;
}
const mockWindow: MockWindow = {
  location: {
    href: "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=test",
    search: "?utm_source=google&utm_medium=cpc&utm_campaign=test",
  },
};
const mockDocument: MockDocument = {
  referrer: "https://google.com",
};
describe("ContextProviders", () => {
  let originalWindow: (Window & typeof globalThis) | undefined;
  let originalDocument: Document | undefined;
  beforeEach(() => {
    originalWindow = global.window;
    originalDocument = global.document;
  });
  afterEach(() => {
    if (originalWindow) {
      global.window = originalWindow;
    } else {
      delete (global as any).window;
    }
    if (originalDocument) {
      global.document = originalDocument;
    } else {
      delete (global as any).document;
    }
  });
  describe("BrowserContextProvider", () => {
    let provider: BrowserContextProvider;
    beforeEach(() => {
      (global as any).window = mockWindow as unknown as Window &
        typeof globalThis;
      (global as any).document = mockDocument as unknown as Document;
      provider = BrowserContextProvider.getInstance();
    });
    it("should extract UTM parameters from URL", () => {
      const params = provider.getUTMParameters();
      expect(params.utm_source).toBe("google");
      expect(params.utm_medium).toBe("cpc");
      expect(params.utm_campaign).toBe("test");
    });
    it("should return current URL", () => {
      const url = provider.getCurrentUrl();
      expect(url).toBe(
        "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=test",
      );
    });
    it("should return referrer", () => {
      const referrer = provider.getReferrer();
      expect(referrer).toBe("https://google.com");
    });
    it("should handle missing UTM parameters gracefully", () => {
      global.window = {
        location: {
          href: "https://example.com/page",
          search: "",
        },
      } as unknown as Window & typeof globalThis;
      provider = BrowserContextProvider.getInstance();
      const params = provider.getUTMParameters();
      expect(params.utm_source === undefined || params.utm_source === "").toBe(
        true,
      );
      expect(params.utm_medium === undefined || params.utm_medium === "").toBe(
        true,
      );
      expect(
        params.utm_campaign === undefined || params.utm_campaign === "",
      ).toBe(true);
    });
    it("should handle server-side environment gracefully", () => {
      delete (global as any).window;
      delete (global as any).document;
      provider = BrowserContextProvider.getInstance();
      const params = provider.getUTMParameters();
      const url = provider.getCurrentUrl();
      const referrer = provider.getReferrer();
      expect(params).toEqual({});
      expect(url).toBe("");
      expect(referrer).toBe("");
    });
    it("should handle complex UTM parameters", () => {
      global.window = {
        location: {
          href: "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=test&utm_id=12345&utm_term=travel&utm_content=banner&other_param=value",
          search:
            "?utm_source=google&utm_medium=cpc&utm_campaign=test&utm_id=12345&utm_term=travel&utm_content=banner&other_param=value",
        },
      } as unknown as Window & typeof globalThis;
      provider = BrowserContextProvider.getInstance();
      const params = provider.getUTMParameters();
      expect(params.utm_source).toBe("google");
      expect(params.utm_medium).toBe("cpc");
      expect(params.utm_campaign).toBe("test");
      expect(params.utm_id).toBe("12345");
      expect(params.utm_term).toBe("travel");
      expect(params.utm_content).toBe("banner");
      expect(params.url).toBe(
        "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=test&utm_id=12345&utm_term=travel&utm_content=banner&other_param=value",
      );
      expect(params.referrer).toBe("https://google.com");
    });
    it("should handle URL with special characters in UTM parameters", () => {
      global.window = {
        location: {
          href: "https://example.com/page?utm_source=google%20ads&utm_medium=cpc&utm_campaign=summer%202024",
          search:
            "?utm_source=google%20ads&utm_medium=cpc&utm_campaign=summer%202024",
        },
      } as unknown as Window & typeof globalThis;
      provider = BrowserContextProvider.getInstance();
      const params = provider.getUTMParameters();
      expect(params.utm_source).toBe("google ads");
      expect(params.utm_medium).toBe("cpc");
      expect(params.utm_campaign).toBe("summer 2024");
    });
    it("should handle empty referrer", () => {
      global.document = {
        referrer: "",
      } as unknown as Document;
      provider = BrowserContextProvider.getInstance();
      const params = provider.getUTMParameters();
      const referrer = provider.getReferrer();
      expect(params.referrer).toBe("");
      expect(referrer).toBe("");
    });
    it("should handle malformed URLs gracefully", () => {
      global.window = {
        location: {
          href: "not-a-valid-url",
          search: "?utm_source=test",
        },
      } as unknown as Window & typeof globalThis;
      provider = BrowserContextProvider.getInstance();
      expect(() => provider.getUTMParameters()).toThrow("Invalid URL");
    });
    it("should handle singleton pattern", () => {
      const provider1 = BrowserContextProvider.getInstance();
      const provider2 = BrowserContextProvider.getInstance();
      expect(provider1).toBe(provider2);
    });
    it("should reset singleton instance", () => {
      const provider1 = BrowserContextProvider.getInstance();
      BrowserContextProvider.resetInstance();
      const provider2 = BrowserContextProvider.getInstance();
      expect(provider1).not.toBe(provider2);
    });
  });
});
