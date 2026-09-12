import { sha256 } from '@noble/hashes/sha2.js'
import { CHUNK_SIZE, AES_GCM_IV_LENGTH } from './constants'
import {
  bytesToBase64,
  bytesToHex,
  concatBytes,
  getWebCrypto,
  uint32ToBytes,
  toArrayBuffer,
} from './helpers'

async function hashFile(file: File): Promise<string> {
  const hasher = sha256.create()
  let offset = 0

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE)
    const chunkBytes = new Uint8Array(await chunk.arrayBuffer())
    hasher.update(chunkBytes)
    offset += chunkBytes.length
  }

  return bytesToHex(hasher.digest())
}

export function generateIV(): Uint8Array {
  const crypto = getWebCrypto()
  return crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH))
}

export async function encryptSmallFile(file: File, key: CryptoKey): Promise<{ encryptedBlob: Blob; iv: string }> {
  const crypto = getWebCrypto()
  const iv = generateIV()
  const plainBytes = await file.arrayBuffer()
  const encryptedBytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, plainBytes)

  return {
    encryptedBlob: new Blob([encryptedBytes], { type: 'application/octet-stream' }),
    iv: bytesToBase64(iv),
  }
}

export async function encryptLargeFile(
  file: File,
  key: CryptoKey,
  onProgress?: (pct: number) => void,
): Promise<{ encryptedBlob: Blob; iv: string }> {
  const crypto = getWebCrypto()
  const records: BlobPart[] = []
  let offset = 0
  let firstChunkIv: Uint8Array | null = null

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size))
    const plainBytes = new Uint8Array(await chunk.arrayBuffer())
    const iv = generateIV()
    if (!firstChunkIv) {
      firstChunkIv = iv
    }

    const encryptedBytes = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(plainBytes)),
    )

    const record = concatBytes(iv, uint32ToBytes(plainBytes.length), encryptedBytes)
    records.push(toArrayBuffer(record))

    offset += plainBytes.length

    if (onProgress) {
      onProgress(Math.min(99, Math.round((offset / file.size) * 100)))
    }
  }

  if (onProgress) {
    onProgress(100)
  }

  return {
    encryptedBlob: new Blob(records, { type: 'application/octet-stream' }),
    iv: bytesToBase64(firstChunkIv ?? generateIV()),
  }
}

export async function encryptFile(
  file: File,
  key: CryptoKey,
  onProgress?: (pct: number) => void,
): Promise<{ encryptedBlob: Blob; iv: string; originalHash: string }> {
  const originalHashPromise = hashFile(file)

  if (file.size <= CHUNK_SIZE) {
    const [encrypted, originalHash] = await Promise.all([encryptSmallFile(file, key), originalHashPromise])

    return {
      encryptedBlob: encrypted.encryptedBlob,
      iv: encrypted.iv,
      originalHash,
    }
  }

  const [encrypted, originalHash] = await Promise.all([encryptLargeFile(file, key, onProgress), originalHashPromise])

  return {
    encryptedBlob: encrypted.encryptedBlob,
    iv: encrypted.iv,
    originalHash,
  }
}
