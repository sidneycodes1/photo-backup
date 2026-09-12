import {
  AES_GCM_TAG_LENGTH,
  LARGE_CHUNK_HEADER_SIZE,
} from './constants'
import {
  base64ToBytes,
  bytesToUint32,
  getWebCrypto,
  toArrayBuffer,
} from './helpers'

async function decryptChunk(ciphertext: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<Uint8Array> {
  const crypto = getWebCrypto()
  const plainBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, ciphertext)
  return new Uint8Array(plainBytes)
}

function isLikelyChunkedBlobSize(size: number): boolean {
  return size >= LARGE_CHUNK_HEADER_SIZE + AES_GCM_TAG_LENGTH
}

async function readChunkHeader(blob: Blob, offset: number): Promise<{ iv: Uint8Array; plainLength: number }> {
  const headerBytes = new Uint8Array(await blob.slice(offset, offset + LARGE_CHUNK_HEADER_SIZE).arrayBuffer())

  if (headerBytes.length !== LARGE_CHUNK_HEADER_SIZE) {
    throw new Error('Encrypted blob is truncated before the chunk header')
  }

  const iv = headerBytes.slice(0, 12)
  const plainLength = bytesToUint32(headerBytes.slice(12, 16))
  return { iv, plainLength }
}

async function decryptChunkedBlob(encryptedBlob: Blob, key: CryptoKey, onProgress?: (pct: number) => void): Promise<Blob> {
  const decryptedChunks: BlobPart[] = []
  let offset = 0
  let processedBytes = 0

  while (offset < encryptedBlob.size) {
    const { iv, plainLength } = await readChunkHeader(encryptedBlob, offset)
    const ciphertextLength = plainLength + AES_GCM_TAG_LENGTH
    const ciphertextStart = offset + LARGE_CHUNK_HEADER_SIZE
    const ciphertextEnd = ciphertextStart + ciphertextLength

    if (ciphertextEnd > encryptedBlob.size) {
      throw new Error('Encrypted blob is truncated before the chunk ciphertext')
    }

    const ciphertext = await encryptedBlob.slice(ciphertextStart, ciphertextEnd).arrayBuffer()
    const plainBytes = await decryptChunk(ciphertext, key, iv)

    if (plainBytes.length !== plainLength) {
      throw new Error('Decrypted chunk length did not match the encoded chunk length')
    }

    decryptedChunks.push(toArrayBuffer(plainBytes))
    offset = ciphertextEnd
    processedBytes = offset

    if (onProgress) {
      onProgress(Math.min(99, Math.round((processedBytes / encryptedBlob.size) * 100)))
    }
  }

  if (onProgress) {
    onProgress(100)
  }

  return new Blob(decryptedChunks, { type: 'application/octet-stream' })
}

export async function decryptSmallFile(encryptedBlob: Blob, key: CryptoKey, ivBase64: string): Promise<Blob> {
  const crypto = getWebCrypto()
  const iv = base64ToBytes(ivBase64)
  const encryptedBytes = await encryptedBlob.arrayBuffer()
  const plainBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, encryptedBytes)

  return new Blob([plainBytes], { type: 'application/octet-stream' })
}

export async function decryptLargeFile(
  encryptedBlob: Blob,
  key: CryptoKey,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  if (!isLikelyChunkedBlobSize(encryptedBlob.size)) {
    throw new Error('Encrypted blob is too small to be a chunked Vaultly payload')
  }

  return decryptChunkedBlob(encryptedBlob, key, onProgress)
}

async function shouldUseChunkedDecrypt(encryptedBlob: Blob, ivBase64: string): Promise<boolean> {
  if (!isLikelyChunkedBlobSize(encryptedBlob.size)) {
    return false
  }

  try {
    const { iv, plainLength } = await readChunkHeader(encryptedBlob, 0)
    const inputIv = base64ToBytes(ivBase64)
    const firstChunkLength = LARGE_CHUNK_HEADER_SIZE + plainLength + AES_GCM_TAG_LENGTH
    const firstIvMatchesInput = inputIv.length === iv.length && inputIv.every((byte, index) => byte === iv[index])

    if (!firstIvMatchesInput) {
      return false
    }

    return firstChunkLength <= encryptedBlob.size
  } catch {
    return false
  }
}

export async function decryptFile(
  encryptedBlob: Blob,
  key: CryptoKey,
  ivBase64: string,
  mimeType: string,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  if (await shouldUseChunkedDecrypt(encryptedBlob, ivBase64)) {
    const decrypted = await decryptLargeFile(encryptedBlob, key, onProgress)
    return new Blob([decrypted], { type: mimeType })
  }

  const decrypted = await decryptSmallFile(encryptedBlob, key, ivBase64)
  return new Blob([decrypted], { type: mimeType })
}
