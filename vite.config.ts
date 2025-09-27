import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AnalyticsEngine',
      fileName: (format) => `analytics-engine.${format}.js`,
      formats: ['es']
    },
            rollupOptions: {
              external: [],
              output: {
                globals: {}
              }
            },
    sourcemap: true,
    minify: true
  }
})
