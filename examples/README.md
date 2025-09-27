# Analytics Engine Examples

This directory contains interactive examples demonstrating the Analytics Engine library capabilities.

## 🚀 Getting Started

### Option 1: Using Vite (Recommended)
```bash
# From the project root
pnpm examples
```
This will start a Vite dev server at `http://localhost:3000` with hot reload.

### Option 2: Build and Serve
1. **Build the library first:**
   ```bash
   pnpm build
   ```

2. **Open the examples:**
   - Open `index.html` in your browser
   - Or serve it with a local server:
     ```bash
     npx serve examples/
     ```

**Note:** The examples use the built library from `../dist/analytics-engine.es.js`. Make sure to run `pnpm build` first if you want to test with the production build.

## 📊 Interactive Examples

### Basic Analytics
- Track page views with automatic UTM parameter detection
- Send user interaction events
- Monitor event counts and provider status

### Advanced Configuration
- Set up multiple analytics providers
- Configure performance monitoring
- Add custom providers and global properties

### Error Handling
- Test robust error handling and recovery
- Simulate provider failures
- Monitor retry mechanisms

### Real-time Monitoring
- Live performance metrics
- Queue status monitoring
- Export analytics data

## 🛠️ Features Demonstrated

- **Lazy Loading**: Providers load only when needed
- **Event Queuing**: Events are queued until providers are ready
- **UTM Parameter Detection**: Automatic extraction from URL
- **Performance Monitoring**: Real-time metrics and monitoring
- **Error Recovery**: Graceful handling of provider failures
- **Custom Providers**: Easy integration of new analytics services

## 💻 Code Examples

The examples include copy-paste code snippets for:

- Basic setup and configuration
- Custom provider implementation
- Error handling patterns
- Performance optimization

## 🔧 Development

To modify the examples:

1. Edit `index.html` for UI changes
2. The JavaScript is embedded in the HTML file
3. Import from the built library: `../dist/analytics-engine.es.js`

## 📈 Testing

The examples include comprehensive testing scenarios:

- High-volume event processing
- Provider failure simulation
- Queue overflow handling
- Performance under load
- Critical event delivery guarantees

All examples are fully functional and demonstrate real-world usage patterns.
