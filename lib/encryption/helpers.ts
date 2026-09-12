export function getWebCrypto(): Crypto {
  const cryptoRef = globalThis.crypto

  if (!cryptoRef || !cryptoRef.subtle) {
    throw new Error('Web Crypto API is not available in this environment')
  }

  return cryptoRef
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }

  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0)
  }

  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex input must have an even length')
  }

  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16)
  }

  return bytes
}

export function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

export function uint32ToBytes(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error('Value must be an unsigned 32-bit integer')
  }

  const view = new DataView(new ArrayBuffer(4))
  view.setUint32(0, value, false)
  return new Uint8Array(view.buffer)
}

export function bytesToUint32(bytes: Uint8Array): number {
  if (bytes.length !== 4) {
    throw new Error('Expected exactly 4 bytes to read a uint32')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return view.getUint32(0, false)
}

export function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const result = new Uint8Array(totalLength)

  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}

export function normalizeWalletAddress(address?: string): string | null {
  const normalized = address?.trim().toLowerCase()
  return normalized && normalized.length > 0 ? normalized : null
}

export function fileLooksLikeImageForExifStripping(mimeType: string): boolean {
  return ['image/jpeg', 'image/jpg', 'image/heic', 'image/heif'].includes(mimeType.toLowerCase())
}
