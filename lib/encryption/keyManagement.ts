// Vault-key management: a random per-user AES-GCM master key, wrapped with an
// AES-KW key derived from the user's vault passphrase via PBKDF2-SHA256
// (600,000 iterations, OWASP floor) with a random per-vault salt. The server
// stores only the wrapped blob plus the plaintext salt and can neither unwrap
// the key nor brute-force it without the passphrase. Trust boundary: the
// unwrapped master key exists only in browser memory (see vaultSession.ts).

import { supabaseProxy } from '@/lib/api/supabaseProxy'
import {
  AES_GCM_ALGORITHM,
  AES_GCM_KEY_LENGTH,
  AES_KW_ALGORITHM,
  PASSPHRASE_MIN_LENGTH,
  PASSPHRASE_SALT_LENGTH,
  PBKDF2_HASH,
  PBKDF2_ITERATIONS,
} from './constants'
import {
  base64ToBytes,
  bytesToBase64,
  encodeUtf8,
  getWebCrypto,
  toArrayBuffer,
} from './helpers'

export type VaultKeyRow = {
  encrypted_key_blob: string
  key_salt: string | null
  key_version: number
}

export type PassphraseCheck = {
  ok: boolean
  reasons: string[]
}

export function generatePassphraseSalt(): Uint8Array {
  const crypto = getWebCrypto()
  return crypto.getRandomValues(new Uint8Array(PASSPHRASE_SALT_LENGTH))
}

export function validatePassphrase(passphrase: string): PassphraseCheck {
  const reasons: string[] = []

  if (passphrase.length < PASSPHRASE_MIN_LENGTH) {
    reasons.push(`Use at least ${PASSPHRASE_MIN_LENGTH} characters.`)
  }

  const classes = [
    /[a-z]/.test(passphrase),
    /[A-Z]/.test(passphrase),
    /[0-9]/.test(passphrase),
    /[^a-zA-Z0-9]/.test(passphrase),
  ].filter(Boolean).length

  if (classes < 3) {
    reasons.push('Include characters from at least 3 of these groups: lowercase, uppercase, digits, symbols.')
  }

  return { ok: reasons.length === 0, reasons }
}

export async function deriveWrappingKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const crypto = getWebCrypto()
  const baseKey = await crypto.subtle.importKey('raw', toArrayBuffer(encodeUtf8(passphrase)), 'PBKDF2', false, [
    'deriveKey',
  ])

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    baseKey,
    { name: AES_KW_ALGORITHM, length: AES_GCM_KEY_LENGTH },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

export async function exportEncryptedKey(key: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const crypto = getWebCrypto()
  const wrappedKey = await crypto.subtle.wrapKey('raw', key, wrappingKey, { name: AES_KW_ALGORITHM })
  return bytesToBase64(new Uint8Array(wrappedKey))
}

export async function importEncryptedKey(encryptedKeyBase64: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const crypto = getWebCrypto()
  const wrappedKey = base64ToBytes(encryptedKeyBase64)

  return crypto.subtle.unwrapKey(
    'raw',
    toArrayBuffer(wrappedKey),
    wrappingKey,
    { name: AES_KW_ALGORITHM },
    { name: AES_GCM_ALGORITHM, length: AES_GCM_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function fetchVaultKeyRow(accessToken: string): Promise<VaultKeyRow | null> {
  const keyResult = await supabaseProxy.getEncryptionKey(accessToken)
  return (keyResult.data as VaultKeyRow | null) ?? null
}

/** True when a wrapped key with a passphrase salt exists server-side. Rows
 *  written by the pre-passphrase scheme (no salt) count as absent: they can
 *  never be unwrapped again and are overwritten on next setup. */
export async function hasUsableVaultKey(accessToken: string): Promise<boolean> {
  const row = await fetchVaultKeyRow(accessToken)
  return Boolean(row?.encrypted_key_blob && row?.key_salt)
}

/** First-use setup: validates the passphrase, generates a fresh master key
 *  and salt, wraps, and stores. Overwrites any pre-passphrase row. */
export async function setupVaultKey(
  passphrase: string,
  confirmPassphrase: string,
  accessToken: string,
): Promise<CryptoKey> {
  if (passphrase !== confirmPassphrase) {
    throw new Error('Passphrases do not match.')
  }

  const check = validatePassphrase(passphrase)
  if (!check.ok) {
    throw new Error(check.reasons.join(' '))
  }

  const crypto = getWebCrypto()
  const key = await crypto.subtle.generateKey(
    {
      name: AES_GCM_ALGORITHM,
      length: AES_GCM_KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt'],
  )

  const salt = generatePassphraseSalt()
  const wrappingKey = await deriveWrappingKeyFromPassphrase(passphrase, salt)
  const encryptedKeyBlob = await exportEncryptedKey(key, wrappingKey)

  await supabaseProxy.saveEncryptionKey(accessToken, encryptedKeyBlob, bytesToBase64(salt), 1)
  return key
}

/** Per-session unlock: re-derives the wrapping key and unwraps. A wrong
 *  passphrase fails closed inside Web Crypto; the error is normalized so
 *  callers cannot distinguish it from a corrupted row. */
export async function unlockVaultKey(passphrase: string, accessToken: string): Promise<CryptoKey> {
  const row = await fetchVaultKeyRow(accessToken)

  if (!row?.encrypted_key_blob || !row?.key_salt) {
    throw new Error('No vault key found for this account. Set up a vault passphrase first.')
  }

  try {
    const wrappingKey = await deriveWrappingKeyFromPassphrase(passphrase, base64ToBytes(row.key_salt))
    return await importEncryptedKey(row.encrypted_key_blob, wrappingKey)
  } catch {
    throw new Error('Incorrect passphrase. Your files remain encrypted and untouched.')
  }
}
