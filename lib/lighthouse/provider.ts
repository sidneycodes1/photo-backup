export type StorageProvider = 'lighthouse' | 'mock'

// Read once when the storage boundary is initialized. Production and normal
// development deliberately default to Lighthouse; tests must opt into mock.
const configuredProvider = process.env.STORAGE_PROVIDER ?? 'lighthouse'

if (configuredProvider !== 'lighthouse' && configuredProvider !== 'mock') {
  throw new Error('STORAGE_PROVIDER must be either "lighthouse" or "mock"')
}

export const storageProvider = configuredProvider as StorageProvider
