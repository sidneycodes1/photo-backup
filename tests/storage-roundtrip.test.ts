// @vitest-environment node
import { webcrypto } from 'node:crypto'
import { File as NodeFile } from 'node:buffer'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

const originalStorageProvider = process.env.STORAGE_PROVIDER

beforeAll(() => {
  process.env.STORAGE_PROVIDER = 'mock'
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

afterAll(() => {
  if (originalStorageProvider === undefined) delete process.env.STORAGE_PROVIDER
  else process.env.STORAGE_PROVIDER = originalStorageProvider
})

describe('mock Lighthouse storage round trip', () => {
  test('encrypts, mock-uploads, retrieves, and decrypts byte-for-byte', async () => {
    vi.resetModules()
    const { encryptFile, decryptFile } = await import('@/lib/encryption')
    const { uploadToLighthouse } = await import('@/lib/lighthouse/client')
    const { fetchEncryptedBlob } = await import('@/lib/lighthouse/retrieve')
    const original = new Uint8Array(webcrypto.getRandomValues(new Uint8Array(8_192)))
    // Node's standards-compatible File/CryptoKey have the same runtime APIs
    // used by the browser pipeline; DOM's declaration adds browser-only types.
    const file = new NodeFile([original], 'round-trip.bin', { type: 'application/octet-stream' }) as unknown as File
    const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as unknown as CryptoKey

    const encrypted = await encryptFile(file, key)
    const cid = await uploadToLighthouse(encrypted.encryptedBlob, file.name, 'not-used-by-mock')
    const storedCiphertext = await fetchEncryptedBlob(cid)
    const decrypted = await decryptFile(storedCiphertext, key, encrypted.iv, file.type)

    expect(cid).toMatch(/^mock-/)
    expect(new Uint8Array(await decrypted.arrayBuffer())).toEqual(original)
  })
})
