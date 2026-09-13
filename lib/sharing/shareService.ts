// Share creation: decrypts with the vault key, re-encrypts under a fresh
// per-share AES-GCM key, uploads a new ciphertext CID, and embeds the raw key
// in the URL fragment only. Trust boundary: the server stores the share CID +
// IV but never sees the share key or the vault key — fragment keys stay local.

import { decryptFile } from '@/lib/encryption'
import { fetchWithRetry } from '@/lib/lighthouse/retrieve'
import { uploadToLighthouse } from '@/lib/lighthouse/client'
import { generateIV } from '@/lib/encryption/fileEncryption'
import { bytesToBase64 } from '@/lib/encryption/helpers'
import { supabaseProxy } from '@/lib/api/supabaseProxy'
import type { BackupRecord } from '@/types'

interface CreateShareOptions {
  backup: BackupRecord
  cryptoKey: CryptoKey
  token: string
  expiresInHours: number
}

interface CreateShareResult {
  shareUrl: string
}

export async function createShare({
  backup,
  cryptoKey,
  token,
  expiresInHours,
}: CreateShareOptions): Promise<CreateShareResult> {
  // Step 1: Fetch + decrypt the original file (reuse restoreService logic)
  const encryptedBlob = await fetchWithRetry(backup.cid)
  const decryptedBlob = await decryptFile(
    encryptedBlob,
    cryptoKey,
    backup.iv,
    backup.mimeType ?? 'application/octet-stream',
  )

  // Step 2: Generate a new random AES-256-GCM key + IV
  const crypto = window.crypto
  const shareKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
  const iv = generateIV()

  // Step 3: Encrypt the decrypted file with the new key/IV
  const decryptedBytes = await decryptedBlob.arrayBuffer()
  const encryptedBytes = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    shareKey,
    decryptedBytes,
  )
  const shareEncryptedBlob = new Blob([encryptedBytes], { type: 'application/octet-stream' })

  // Step 4: Upload the new ciphertext to Lighthouse
  const shareCid = await uploadToLighthouse(
    shareEncryptedBlob,
    backup.originalFilename ?? `vaultly-share-${backup.id}`,
    token,
  )

  // Step 5: Export the share key to raw bytes and base64url-encode it
  const rawKey = await crypto.subtle.exportKey('raw', shareKey)
  const keyBytes = new Uint8Array(rawKey)
  const base64Key = bytesToBase64(keyBytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  // Step 6: Call the proxy to create the share record
  const { data } = await supabaseProxy.createShare(
    token,
    backup.id,
    shareCid,
    bytesToBase64(iv),
    backup.mimeType,
    backup.originalFilename,
    expiresInHours,
  )

  if (!data?.id) {
    throw new Error('Failed to create share record')
  }

  // Step 7: Build the URL with the key in the fragment
  const origin = window.location.origin
  const shareUrl = `${origin}/share/${data.id}#key=${base64Key}`

  return { shareUrl }
}
