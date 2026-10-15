import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/unit/**/*.{test,spec}.ts',
      'tests/components/**/*.{test,spec}.tsx',
      'tests/integration/**/*.{test,spec}.ts',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    fileParallelism: false,
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
