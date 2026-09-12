import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: process.cwd(),
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['lib/encryption/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
