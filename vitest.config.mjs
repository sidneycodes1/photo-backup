import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: process.cwd(),
  resolve: {
    alias: {
      '@': process.cwd(),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['lib/encryption/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 120000,
    hookTimeout: 120000,
  },
})
