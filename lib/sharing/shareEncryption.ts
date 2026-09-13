// Share crypto helpers: per-share key generate/export/import and
// decrypt-then-re-encrypt for a new share CID, with fragment encode/decode.
// Trust boundary: same as shareService — keys live in browser memory and URL
// fragments; only the re-encrypted CID + IV are ever sent to the server.

import { generateIV, encryptFile, decryptFile } from '@/lib/encryption'
import { bytesToBase64, base64ToBytes, getWebCrypto, toArrayBuffer } from '@/lib/encryption/helpers'
import { fetchEncryptedBlob } from '@/lib/lighthouse/retrieve'
import { uploadToLighthouse } from '@/lib/lighthouse/client'

export async function generateShareKey(): Promise<CryptoKey> {
  const crypto = getWebCrypto()
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function exportShareKey(key: CryptoKey): Promise<string> {
  const crypto = getWebCrypto()
  const exported = await crypto.subtle.exportKey('raw', key)
  return bytesToBase64(new Uint8Array(exported))
}

export async function importShareKey(keyBase64: string): Promise<CryptoKey> {
  const crypto = getWebCrypto()
  const keyBytes = base64ToBytes(keyBase64)
  return await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function reEncryptForShare(
  cid: string,
  iv: string,
  mimeType: string,
  ownerKey: CryptoKey,
  shareKey: CryptoKey,
  accessToken: string,
  onProgress?: (pct: number) => void
): Promise<{ newCid: string; newIv: string }> {
  // Download the encrypted file from Lighthouse
  const encryptedBlob = await fetchEncryptedBlob(cid)
  
  // Decrypt with owner's key
  const decryptedBlob = await decryptFile(encryptedBlob, ownerKey, iv, mimeType, (pct) => {
    onProgress?.(pct * 0.5) // First half: decryption
  })
  
  // Re-encrypt with share key
  const { encryptedBlob: reEncryptedBlob, iv: newIv } = await encryptFile(
    new File([decryptedBlob], 'shared-file', { type: mimeType }),
    shareKey,
    (pct) => {
      onProgress?.(50 + pct * 0.5) // Second half: encryption
    }
  )
  
  // Upload re-encrypted file to Lighthouse
  const newCid = await uploadToLighthouse(reEncryptedBlob, 'shared-file', accessToken)
  
  return { newCid, newIv }
}

export function encodeShareKeyInFragment(shareKeyBase64: string): string {
  return `#key=${encodeURIComponent(shareKeyBase64)}`
}

export function decodeShareKeyFromFragment(fragment: string): string | null {
  const match = fragment.match(/key=([^&]+)/)
  return match ? decodeURIComponent(match[1]) : null
}
