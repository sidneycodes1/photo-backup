import { webcrypto } from 'node:crypto'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { decryptFile } from '../fileDecryption'
import { encryptFile, generateIV } from '../fileEncryption'

const keyStore = vi.hoisted(() => ({ row: null as null | Record<string, unknown> }))

vi.mock('@/lib/api/supabaseProxy', () => ({
  supabaseProxy: {
    getEncryptionKey: vi.fn(async () => ({ data: keyStore.row })),
    saveEncryptionKey: vi.fn(
      async (_token: string, encryptedKeyBlob: string, keySalt: string, keyVersion = 1) => {
        keyStore.row = { encrypted_key_blob: encryptedKeyBlob, key_salt: keySalt, key_version: keyVersion }
        return { success: true }
      },
    ),
  },
}))

import {
  deriveWrappingKeyFromPassphrase,
  exportEncryptedKey,
  generatePassphraseSalt,
  hasUsableVaultKey,
  setupVaultKey,
  unlockVaultKey,
  validatePassphrase,
} from '../keyManagement'

function ensureWebCrypto() {
  const currentCrypto = globalThis.crypto as Crypto | undefined

  if (!currentCrypto || !currentCrypto.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    })
  }

  // jsdom's File/Blob shims in this project do not reliably implement
  // arrayBuffer(), while Vaultly's real file pipeline depends on it.
  Object.defineProperty(globalThis, 'Blob', {
    value: NodeBlob,
    configurable: true,
  })

  Object.defineProperty(globalThis, 'File', {
    value: NodeFile,
    configurable: true,
  })
}

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size)
  const maxChunkSize = 65_536

  for (let offset = 0; offset < bytes.length; offset += maxChunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + maxChunkSize, bytes.length))
    webcrypto.getRandomValues(chunk)
  }

  return bytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

async function expectBlobBytesToMatch(blob: Blob, expected: Uint8Array) {
  const actual = new Uint8Array(await blob.arrayBuffer())
  expect(actual.byteLength).toBe(expected.byteLength)
  expect(Buffer.compare(Buffer.from(actual), Buffer.from(expected))).toBe(0)
}

async function createTestKey(): Promise<CryptoKey> {
  const key = await webcrypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt'],
  )

  return key as CryptoKey
}

beforeAll(() => {
  ensureWebCrypto()
})

beforeEach(() => {
  keyStore.row = null
})

describe('Vaultly encryption engine', () => {
  test('small file encrypts and decrypts back to the original bytes', async () => {
    const originalBytes = randomBytes(1024)
    const file = new File([toArrayBuffer(originalBytes)], 'small.bin', { type: 'application/octet-stream' })
    const key = await createTestKey()

    const encrypted = await encryptFile(file, key)
    const decrypted = await decryptFile(encrypted.encryptedBlob, key, encrypted.iv, file.type)

    await expectBlobBytesToMatch(decrypted, originalBytes)
  })

  test('large file encrypts and decrypts back to the original bytes', async () => {
    const size = 21 * 1024 * 1024
    const originalBytes = randomBytes(size)
    const file = new File([toArrayBuffer(originalBytes)], 'large.bin', { type: 'application/octet-stream' })
    const key = await createTestKey()
    const progress: number[] = []

    const encrypted = await encryptFile(file, key, (pct) => {
      progress.push(pct)
    })
    const decrypted = await decryptFile(encrypted.encryptedBlob, key, encrypted.iv, file.type)

    expect(progress.length).toBeGreaterThan(0)
    expect(progress.at(-1)).toBe(100)
    await expectBlobBytesToMatch(decrypted, originalBytes)
  })

  test('SHA-256 hash is stable across calls for the same file input', async () => {
    const originalBytes = randomBytes(4096)
    const file = new File([toArrayBuffer(originalBytes)], 'hash.bin', { type: 'application/octet-stream' })
    const key = await createTestKey()

    const first = await encryptFile(file, key)
    const second = await encryptFile(file, key)

    expect(first.originalHash).toBe(second.originalHash)
  })

  test('generateIV returns unique values across repeated calls', () => {
    const values = new Set<string>()

    for (let index = 0; index < 1000; index += 1) {
      values.add(Buffer.from(generateIV()).toString('hex'))
    }

    expect(values.size).toBe(1000)
  })

  test('validatePassphrase enforces length and character-class rules', () => {
    expect(validatePassphrase('short1!A').ok).toBe(false)
    expect(validatePassphrase('alllowercaseletters').ok).toBe(false)
    expect(validatePassphrase('LongEnoughButOnlyLower').ok).toBe(false)
    expect(validatePassphrase('Correct-Horse-9').ok).toBe(true)
  })

  test('passphrase setup then unlock round-trips to the same vault key', async () => {
    const created = await setupVaultKey('Correct-Horse-9', 'Correct-Horse-9', 'test-token')
    expect(await hasUsableVaultKey('test-token')).toBe(true)

    // Unwrapped keys are non-extractable by design, so equality is proven
    // behaviorally: each key decrypts what the other encrypted.
    const unlocked = await unlockVaultKey('Correct-Horse-9', 'test-token')
    const originalBytes = randomBytes(512)
    const file = new File([toArrayBuffer(originalBytes)], 'vault.bin', { type: 'application/octet-stream' })

    const encryptedByCreated = await encryptFile(file, created)
    const decryptedByUnlocked = await decryptFile(
      encryptedByCreated.encryptedBlob,
      unlocked,
      encryptedByCreated.iv,
      file.type,
    )
    await expectBlobBytesToMatch(decryptedByUnlocked, originalBytes)

    const encryptedByUnlocked = await encryptFile(file, unlocked)
    const decryptedByCreated = await decryptFile(
      encryptedByUnlocked.encryptedBlob,
      created,
      encryptedByUnlocked.iv,
      file.type,
    )
    await expectBlobBytesToMatch(decryptedByCreated, originalBytes)
  })

  test('unlock with the wrong passphrase fails closed', async () => {
    await setupVaultKey('Correct-Horse-9', 'Correct-Horse-9', 'test-token')
    await expect(unlockVaultKey('Wrong-Horse-000', 'test-token')).rejects.toThrow('Incorrect passphrase')
  })

  test('setup rejects mismatched confirmation and weak passphrases', async () => {
    await expect(setupVaultKey('Correct-Horse-9', 'Different-Horse-9', 'test-token')).rejects.toThrow(
      'do not match',
    )
    await expect(setupVaultKey('weak', 'weak', 'test-token')).rejects.toThrow()
    expect(await hasUsableVaultKey('test-token')).toBe(false)
  })

  test('salts are unique per vault and mismatched salts cannot unwrap', async () => {
    const saltA = generatePassphraseSalt()
    const saltB = generatePassphraseSalt()
    expect(Buffer.from(saltA)).not.toEqual(Buffer.from(saltB))

    const wrappingA = await deriveWrappingKeyFromPassphrase('Correct-Horse-9', saltA)
    const wrappingB = await deriveWrappingKeyFromPassphrase('Correct-Horse-9', saltB)
    const master = await createTestKey()
    const blob = await exportEncryptedKey(master, wrappingA)

    const { importEncryptedKey } = await import('../keyManagement')
    await expect(importEncryptedKey(blob, wrappingB)).rejects.toThrow()
  })

  test('pre-passphrase rows without a salt count as unusable', async () => {
    keyStore.row = { encrypted_key_blob: 'legacy-blob', key_salt: null, key_version: 1 }
    expect(await hasUsableVaultKey('test-token')).toBe(false)
    await expect(unlockVaultKey('Correct-Horse-9', 'test-token')).rejects.toThrow('Set up a vault passphrase')
  })
})
