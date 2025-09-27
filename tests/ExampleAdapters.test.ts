import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AmplitudeAdapter,
  createAmplitudeAdapter,
} from "../examples/AmplitudeAdapter";
import {
  GoogleAnalyticsAdapter,
  createGoogleAnalyticsAdapter,
} from "../examples/GoogleAnalyticsAdapter";
import type { IAnalyticsLogger } from "../src/types/IAnalyticsEvent";
class MockLogger implements IAnalyticsLogger {
  public logs: Array<{ level: string; message: string; data?: unknown }> = [];
  debug(message: string, data?: unknown): void {
    this.logs.push({ level: "debug", message, data });
  }
  info(message: string, data?: unknown): void {
    this.logs.push({ level: "info", message, data });
  }
  warn(message: string, data?: unknown): void {
    this.logs.push({ level: "warn", message, data });
  }
  error(message: string, data?: unknown): void {
    this.logs.push({ level: "error", message, data });
  }
}
describe("Example Adapters", () => {
  let mockLogger: MockLogger;
  let originalWindow: (Window & typeof globalThis) | undefined;
  beforeEach(() => {
    originalWindow = global.window;
    global.window = {
      amplitude: {
        init: vi.fn(),
        track: vi.fn(),
        setUserId: vi.fn(),
        add: vi.fn(),
      },
      sessionReplay: {
        plugin: vi.fn(() => ({})),
      },
      gtag: vi.fn(),
      dataLayer: [],
    } as unknown as Window & typeof globalThis;
    mockLogger = new MockLogger();
  });
  afterEach(() => {
    if (originalWindow) {
      global.window = originalWindow;
    }
  });
  describe("AmplitudeAdapter", () => {
    it("should create amplitude adapter with config", () => {
      const config = {
        apiKey: "test-api-key",
        options: {
          defaultTracking: {
            sessions: true,
            attribution: true,
          },
        },
      };
      const adapter = new AmplitudeAdapter(config, mockLogger);
      expect(adapter).toBeDefined();
    });
    it("should create amplitude adapter using factory function", () => {
      const config = {
        apiKey: "test-api-key",
      };
      const adapter = createAmplitudeAdapter(config, mockLogger);
      expect(adapter).toBeDefined();
    });
    it("should load amplitude SDK", async () => {
      const config = {
        apiKey: "test-api-key",
      };
      const mockScript = {
        src: "",
        async: false,
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      const createElementSpy = vi
        .spyOn(document, "createElement")
        .mockReturnValue(mockScript as unknown as HTMLScriptElement);
      const appendChildSpy = vi
        .spyOn(document.head, "appendChild")
        .mockImplementation(() => {
          if (mockScript.onload) {
            setTimeout(mockScript.onload, 0);
          }
          return mockScript as unknown as HTMLScriptElement;
        });
      const adapter = new AmplitudeAdapter(config, mockLogger);
      await adapter.load();
      expect(createElementSpy).toHaveBeenCalledWith("script");
      expect(appendChildSpy).toHaveBeenCalled();
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
    });
    it("should initialize amplitude", () => {
      const config = {
        apiKey: "test-api-key",
        options: {
          defaultTracking: {
            sessions: true,
          },
        },
      };
      const adapter = new AmplitudeAdapter(config, mockLogger);
      adapter.init();
      expect((global.window as any).amplitude?.init).toHaveBeenCalledWith(
        "test-api-key",
        config.options,
      );
    });
    it("should send events to amplitude", () => {
      const config = {
        apiKey: "test-api-key",
      };
      const adapter = new AmplitudeAdapter(config, mockLogger);
      adapter.send("test_event", { property: "value" });
      expect((global.window as any).amplitude?.track).toHaveBeenCalledWith(
        "test_event",
        { property: "value" },
      );
    });
    it("should set user ID", () => {
      const config = {
        apiKey: "test-api-key",
      };
      const adapter = new AmplitudeAdapter(config, mockLogger);
      adapter.setUserId("user123");
      expect((global.window as any).amplitude?.setUserId).toHaveBeenCalledWith(
        "user123",
      );
    });
    it("should handle configuration options", () => {
      const config = {
        apiKey: "test-api-key",
        options: {
          defaultTracking: {
            sessions: true,
            attribution: true,
          },
          autocapture: {
            pageViews: true,
            elementInteractions: false,
          },
        },
      };
      const adapter = new AmplitudeAdapter(config, mockLogger);
      expect(adapter).toBeDefined();
    });
    it("should destroy adapter", () => {
      const config = {
        apiKey: "test-api-key",
      };
      const adapter = new AmplitudeAdapter(config, mockLogger);
      adapter.destroy();
    });
  });
  describe("GoogleAnalyticsAdapter", () => {
    it("should create Google Analytics adapter with config", () => {
      const config = {
        measurementId: "GA-123456789",
        debugMode: true,
        sendPageView: false,
      };
      const adapter = new GoogleAnalyticsAdapter(config, mockLogger);
      expect(adapter).toBeDefined();
    });
    it("should create Google Analytics adapter using factory function", () => {
      const config = {
        measurementId: "GA-123456789",
      };
      const adapter = createGoogleAnalyticsAdapter(config, mockLogger);
      expect(adapter).toBeDefined();
    });
    it("should load Google Analytics SDK", async () => {
      const config = {
        measurementId: "GA-123456789",
      };
      const mockScript = {
        src: "",
        async: false,
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      const createElementSpy = vi
        .spyOn(document, "createElement")
        .mockReturnValue(mockScript as unknown as HTMLScriptElement);
      const appendChildSpy = vi
        .spyOn(document.head, "appendChild")
        .mockImplementation(() => {
          if (mockScript.onload) {
            setTimeout(mockScript.onload, 0);
          }
          return mockScript as unknown as HTMLScriptElement;
        });
      const adapter = new GoogleAnalyticsAdapter(config, mockLogger);
      await adapter.load();
      expect(createElementSpy).toHaveBeenCalledWith("script");
      expect(appendChildSpy).toHaveBeenCalled();
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
    });
    it("should initialize Google Analytics", () => {
      const config = {
        measurementId: "GA-123456789",
        debugMode: true,
        sendPageView: false,
      };
      const adapter = new GoogleAnalyticsAdapter(config, mockLogger);
      adapter.init();
      expect((global.window as any).gtag).toHaveBeenCalledWith(
        "js",
        expect.any(Date),
      );
      expect((global.window as any).gtag).toHaveBeenCalledWith(
        "config",
        "GA-123456789",
        {
          debug_mode: true,
          send_page_view: false,
        },
      );
    });
    it("should send events to Google Analytics", () => {
      const config = {
        measurementId: "GA-123456789",
      };
      const adapter = new GoogleAnalyticsAdapter(config, mockLogger);
      adapter.send("test_event", { property: "value" });
      expect((global.window as any).gtag).toHaveBeenCalledWith(
        "event",
        "test_event",
        { property: "value" },
      );
    });
    it("should send events without options", () => {
      const config = {
        measurementId: "GA-123456789",
      };
      const adapter = new GoogleAnalyticsAdapter(config, mockLogger);
      adapter.send("test_event");
      expect((global.window as any).gtag).toHaveBeenCalledWith(
        "event",
        "test_event",
      );
    });
    it("should set user ID", () => {
      const config = {
        measurementId: "GA-123456789",
      };
      const adapter = new GoogleAnalyticsAdapter(config, mockLogger);
      adapter.setUserId("user123");
      expect((global.window as any).gtag).toHaveBeenCalledWith(
        "config",
        "GA-123456789",
        {
          user_id: "user123",
        },
      );
    });
    it("should destroy adapter", () => {
      const config = {
        measurementId: "GA-123456789",
      };
      const adapter = new GoogleAnalyticsAdapter(config, mockLogger);
      adapter.destroy();
    });
  });
  describe("Error Handling", () => {
    it("should handle missing amplitude SDK gracefully", () => {
      global.window = {} as unknown as Window & typeof globalThis;
      const config = {
        apiKey: "test-api-key",
      };
      const adapter = new AmplitudeAdapter(config, mockLogger);
      expect(() => adapter.send("test_event")).not.toThrow();
    });
    it("should handle missing Google Analytics SDK gracefully", () => {
      global.window = {} as unknown as Window & typeof globalThis;
      const config = {
        measurementId: "GA-123456789",
      };
      const adapter = new GoogleAnalyticsAdapter(config, mockLogger);
      expect(() => adapter.send("test_event")).not.toThrow();
    });
    it("should log errors appropriately", () => {
      const errorLogs = mockLogger.logs.filter((log) => log.level === "error");
      expect(errorLogs).toHaveLength(0);
    });
  });
});
