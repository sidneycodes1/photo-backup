// @vitest-environment node
import { webcrypto } from 'node:crypto'
import { File as NodeFile } from 'node:buffer'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({ duplicate: false }))
const originalStorageProvider = process.env.STORAGE_PROVIDER

vi.mock('@/lib/api/supabaseProxy', () => ({
  supabaseProxy: {
    checkDuplicate: vi.fn(async () => ({ data: state.duplicate ? { id: 'existing-backup' } : null })),
  },
}))

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

describe('upload duplicate detection', () => {
  test('rejects a second upload of the same file hash', async () => {
    vi.resetModules()
    state.duplicate = false
    const { uploadFile, DuplicateFileError } = await import('@/lib/upload/uploadService')
    const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const file = new NodeFile([new TextEncoder().encode('same file, same hash')], 'duplicate.bin', {
      type: 'application/octet-stream',
    }) as unknown as File
    const params = {
      file,
      token: 'test-token',
      userId: 'test-user',
      cryptoKey: key as unknown as CryptoKey,
      onEncryptProgress: () => undefined,
      onUploadProgress: () => undefined,
    }

    await expect(uploadFile(params)).resolves.toMatchObject({ originalHash: expect.any(String) })
    state.duplicate = true
    await expect(uploadFile(params)).rejects.toBeInstanceOf(DuplicateFileError)
  })
})
