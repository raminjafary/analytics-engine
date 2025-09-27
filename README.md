# Analytics Engine

A generic, extensible, and configurable analytics engine for JavaScript applications with comprehensive testing and examples.

## ✨ Features

- 🚀 **Framework Agnostic** - Works with any JavaScript framework or vanilla JS
- 🔧 **Highly Extensible** - Easy to implement custom analytics providers and adapters
- 📊 **Multiple Providers** - Support for multiple analytics services simultaneously
- 🎯 **Context Aware** - Built-in UTM parameter tracking and context management
- ⚡ **Performance Optimized** - Lazy loading, batching, and smart queuing
- 🛠️ **TypeScript Ready** - Full TypeScript support with comprehensive types
- 🧪 **Comprehensive Testing** - 158+ tests including stress tests and performance benchmarks
- 📈 **Real-time Monitoring** - Built-in performance monitoring and metrics
- 🔄 **Zero Data Loss** - Guaranteed event delivery with smart queue management
- 🛡️ **Error Resilient** - Robust error handling and recovery mechanisms

## 📦 Installation

```bash
npm install @raminjafary/analytics-engine
# or
yarn add @raminjafary/analytics-engine
# or
pnpm add @raminjafary/analytics-engine
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { 
  AnalyticsEngine, 
  BrowserContextProvider, 
  BrowserStorageAdapter,
  AmplitudeAdapter,
  GoogleAnalyticsAdapter
} from '@raminjafary/analytics-engine';

// Create the analytics engine
const engine = new AnalyticsEngine({
  maxQueueSize: 1000,
  lazyLoading: true,
  debug: true
});

// Set up context provider for UTM tracking
const contextProvider = BrowserContextProvider.getInstance();
engine.setContextProvider(contextProvider);

// Add analytics providers
const amplitudeAdapter = new AmplitudeAdapter({
  apiKey: 'your-amplitude-api-key',
  options: {
    defaultTracking: { sessions: true, attribution: true }
  }
});

const gaAdapter = new GoogleAnalyticsAdapter({
  measurementId: 'G-XXXXXXXXXX'
});

engine.addProvider(amplitudeAdapter, 'amplitude');
engine.addProvider(gaAdapter, 'google-analytics');

// Track events
engine.send('user_signup', { plan: 'premium', value: 99.99 });
engine.send('page_view', { page: '/dashboard', title: 'Dashboard' });
```

### Interactive Examples

Check out the comprehensive examples in the `/examples` directory:

```bash
# Build the library first
pnpm build

# Open examples in browser
open examples/index.html
```

The examples include:
- 📊 **Basic Analytics** - Track events with automatic UTM detection
- ⚙️ **Advanced Configuration** - Multiple providers and performance monitoring
- 🛡️ **Error Handling** - Test robust error recovery
- 📈 **Real-time Monitoring** - Live performance metrics and queue status

## 🔧 Custom Implementation

### Custom Analytics Adapter

```typescript
import { BaseAnalyticsAdapter, IAnalyticsEvent, IAnalyticsLogger } from '@raminjafary/analytics-engine';

class MyCustomAdapter extends BaseAnalyticsAdapter implements IAnalyticsEvent {
  private apiKey: string;
  private customSDK: any;

  constructor(apiKey: string, logger?: IAnalyticsLogger) {
    super(logger);
    this.apiKey = apiKey;
  }

  async load(callback?: () => void): Promise<void> {
    // Load your analytics SDK
    await this.loadCustomSDK();
    this.isLoaded = true;
    callback?.();
  }

  init(): void {
    // Initialize your analytics service
    this.customSDK.init(this.apiKey);
    this.isInitialized = true;
  }

  send<T>(eventName: string, options?: T): void {
    if (!this.isLoaded) return;
    this.customSDK.track(eventName, options);
  }

  setUserId(userId: string): void {
    this.customSDK.setUserId(userId);
  }

  private async loadCustomSDK(): Promise<void> {
    // Implementation for loading your custom SDK
  }
}
```

### Custom Context Provider

```typescript
import { BaseContextProvider, IContextProvider, UTMParameters } from '@raminjafary/analytics-engine';

class MyCustomContextProvider extends BaseContextProvider implements IContextProvider {
  getUTMParameters(): UTMParameters {
    // Your custom UTM parameter extraction logic
    return {
      utm_source: this.getCustomUTMSource(),
      utm_medium: this.getCustomUTMMedium(),
      utm_campaign: this.getCustomUTMCampaign(),
      // ... other parameters
    };
  }

  getCurrentUrl(): string {
    return window.location.href;
  }

  getReferrer(): string {
    return document.referrer;
  }

  protected cacheAllContextData(): void {
    const contextData = {
      utm: this.getUTMParameters(),
      customData: this.getCustomData(),
      timestamp: Date.now()
    };
    this.cacheContextData(contextData);
  }

  private getCustomUTMSource(): string | undefined {
    // Your implementation
  }

  private getCustomData(): Record<string, unknown> {
    // Your implementation
  }
}
```

### Custom Storage Adapter

```typescript
import { BaseStorageAdapter, IStorageAdapter, ContextData } from '@raminjafary/analytics-engine';

class MyCustomStorageAdapter extends BaseStorageAdapter implements IStorageAdapter {
  private storage: Map<string, ContextData> = new Map();

  set(key: string, data: ContextData): void {
    this.storage.set(key, data);
  }

  get(key: string): ContextData | null {
    return this.storage.get(key) || null;
  }

  remove(key: string): void {
    this.storage.delete(key);
  }

  isEnabled(): boolean {
    return true;
  }
}
```

## 📚 API Reference

### AnalyticsEngine

The main analytics engine class with comprehensive configuration options.

#### Constructor Options

```typescript
interface AnalyticsEngineConfig {
  maxQueueSize?: number;           // Maximum queue size (default: 1000)
  maxRetries?: number;            // Maximum retry attempts (default: 3)
  batchSize?: number;             // Batch size for processing (default: 10)
  batchTimeout?: number;          // Batch timeout in ms (default: 2000)
  lazyLoading?: boolean;          // Enable lazy loading (default: true)
  maxProviderQueueSize?: number; // Max provider queue size (default: 500)
  eagerProviders?: string[];     // Providers to load immediately
  enableSmartDequeue?: boolean;  // Enable smart queue management (default: true)
  maxSentEventsToKeep?: number;  // Max sent events to keep (default: 50)
  contextCacheTimeout?: number;  // Context cache timeout
  debug?: boolean;               // Enable debug logging
  logger?: IAnalyticsLogger;     // Custom logger
}
```

#### Core Methods

- `addProvider(provider: IAnalyticsEvent, name?: string, config?: Partial<ProviderConfig>): void`
- `removeProvider(providerName: string): void`
- `send<T>(eventName: string, options?: T): void`
- `sendToProviders<T>(eventName: string, providerNames: string[], options?: T): void`
- `setUserId(userId: string): void`
- `setGlobalProperties(properties: Record<string, unknown>): void`
- `setContextProvider(provider: IContextProvider): void`
- `flushQueue(): void`
- `clearQueue(): void`
- `getQueueSize(): number`
- `getPerformanceMetrics(): PerformanceMetrics`
- `reset(): void`
- `destroy(): void`

### Built-in Providers

#### AmplitudeAdapter

```typescript
const amplitudeAdapter = new AmplitudeAdapter({
  apiKey: 'your-api-key',
  options: {
    defaultTracking: { sessions: true, attribution: true },
    autocapture: { pageViews: true, elementInteractions: false }
  }
});
```

#### GoogleAnalyticsAdapter

```typescript
const gaAdapter = new GoogleAnalyticsAdapter({
  measurementId: 'G-XXXXXXXXXX',
  config: {
    send_page_view: true,
    custom_map: { dimension1: 'user_type' }
  }
});
```

### Built-in Context Providers

#### BrowserContextProvider

Automatically extracts UTM parameters from URL and provides browser context.

```typescript
const contextProvider = BrowserContextProvider.getInstance();
engine.setContextProvider(contextProvider);
```

### Built-in Storage Adapters

#### BrowserStorageAdapter

```typescript
const storageAdapter = new BrowserStorageAdapter({
  storageType: 'sessionStorage', // or 'localStorage'
  enabled: true
});
```

## 🧪 Testing

The library includes comprehensive testing with 158+ tests covering:

- **Unit Tests** - Core functionality and edge cases
- **Integration Tests** - Provider integration and context management
- **Performance Tests** - Load testing and performance benchmarks
- **Stress Tests** - High-volume event processing and zero data loss guarantees
- **Error Handling** - Robust error recovery and resilience testing

Run tests:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests once
pnpm test:run
```

## 📊 Performance Features

- **Lazy Loading** - Providers load only when needed
- **Smart Queuing** - Intelligent event queuing with overflow protection
- **Batch Processing** - Efficient batch processing of events
- **Performance Monitoring** - Real-time metrics and monitoring
- **Memory Management** - Automatic cleanup and memory optimization
- **Zero Data Loss** - Guaranteed event delivery with retry mechanisms

## 🔧 Development

### Building

```bash
# Build the library
pnpm build

# Build in watch mode
pnpm dev
```

### Linting and Formatting

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type checking
pnpm type-check
```

## 📈 Examples and Use Cases

### E-commerce Analytics

```typescript
// Track purchase events
engine.send('purchase', {
  transaction_id: 'txn_12345',
  value: 99.99,
  currency: 'USD',
  items: [
    { id: 'item_1', name: 'Premium Plan', category: 'subscription', quantity: 1, price: 99.99 }
  ]
});

// Track user journey
engine.send('user_journey', {
  step: 'checkout_started',
  cart_value: 199.98,
  user_type: 'returning'
});
```

### SaaS Analytics

```typescript
// Track feature usage
engine.send('feature_used', {
  feature: 'advanced_search',
  user_plan: 'premium',
  usage_count: 5
});

// Track subscription events
engine.send('subscription_changed', {
  from_plan: 'basic',
  to_plan: 'premium',
  billing_cycle: 'monthly'
});
```

### Marketing Analytics

```typescript
// Track campaign performance
engine.send('campaign_viewed', {
  campaign_id: 'summer_sale_2024',
  source: 'email',
  medium: 'newsletter',
  content: 'banner_top'
});
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 **Documentation** - Check the `/examples` directory for comprehensive examples
- 🐛 **Issues** - Report bugs and feature requests on GitHub
- 💬 **Discussions** - Join community discussions
- 📧 **Contact** - Reach out for enterprise support

---

Built with ❤️ for the JavaScript community. Framework-agnostic, type-safe, and production-ready.