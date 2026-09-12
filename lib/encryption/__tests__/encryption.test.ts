import { webcrypto } from 'node:crypto'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { beforeAll, describe, expect, test } from 'vitest'
import { decryptFile } from '../fileDecryption'
import { encryptFile, generateIV } from '../fileEncryption'
import { deriveKeyBytesFromPrivyUser } from '../keyManagement'

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

  test('key derivation is deterministic for the same Privy user ID', async () => {
    const first = await deriveKeyBytesFromPrivyUser('did:privy:user:123')
    const second = await deriveKeyBytesFromPrivyUser('did:privy:user:123')

    expect(Array.from(first)).toEqual(Array.from(second))
    expect(first).toHaveLength(32)
  })
})
