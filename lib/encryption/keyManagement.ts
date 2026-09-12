import { sha256 } from '@noble/hashes/sha2.js'
import { supabaseProxy } from '@/lib/api/supabaseProxy'
import {
  AES_GCM_ALGORITHM,
  AES_GCM_KEY_LENGTH,
  AES_KW_ALGORITHM,
  PBKDF2_HASH,
  PBKDF2_ITERATIONS,
  SALT_LENGTH,
} from './constants'
import {
  base64ToBytes,
  bytesToBase64,
  encodeUtf8,
  getWebCrypto,
  toArrayBuffer,
} from './helpers'

type EncryptionKeyRow = {
  encrypted_key_blob: string
  key_version: number
}

const userKeyPromiseCache = new Map<string, Promise<CryptoKey>>()

async function deriveSeedBytes(privyUserId: string, _userEmbeddedWalletAddress?: string): Promise<Uint8Array> {
  const crypto = getWebCrypto()
  const salt = sha256(encodeUtf8(privyUserId))

  if (salt.length !== SALT_LENGTH) {
    throw new Error('Failed to derive a 32-byte salt from the Privy user ID')
  }

  const baseKey = await crypto.subtle.importKey('raw', toArrayBuffer(encodeUtf8(privyUserId)), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    baseKey,
    AES_GCM_KEY_LENGTH,
  )

  return new Uint8Array(bits)
}

async function deriveWrappingKey(privyUserId: string, _userEmbeddedWalletAddress?: string): Promise<CryptoKey> {
  const crypto = getWebCrypto()
  const seedBytes = await deriveSeedBytes(privyUserId, _userEmbeddedWalletAddress)

  return crypto.subtle.importKey('raw', toArrayBuffer(seedBytes), { name: AES_KW_ALGORITHM }, false, ['wrapKey', 'unwrapKey'])
}

export async function deriveKeyBytesFromPrivyUser(privyUserId: string, _userEmbeddedWalletAddress?: string): Promise<Uint8Array> {
  return deriveSeedBytes(privyUserId, _userEmbeddedWalletAddress)
}

export async function deriveKeyFromPrivyUser(privyUserId: string, _userEmbeddedWalletAddress?: string): Promise<CryptoKey> {
  const crypto = getWebCrypto()
  const keyBytes = await deriveSeedBytes(privyUserId, _userEmbeddedWalletAddress)

  return crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), { name: AES_GCM_ALGORITHM }, false, ['encrypt', 'decrypt'])
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

export async function storeUserKey(privyUserId: string, key: CryptoKey, accessToken: string): Promise<void> {
  await storeUserKeyVersion(privyUserId, key, accessToken, 1)
}

export async function storeUserKeyVersion(privyUserId: string, key: CryptoKey, accessToken: string, keyVersion: number): Promise<void> {
  const wrappingKey = await deriveWrappingKey(privyUserId)
  const encryptedKeyBlob = await exportEncryptedKey(key, wrappingKey)

  await supabaseProxy.saveEncryptionKey(accessToken, encryptedKeyBlob, keyVersion)
}

export async function rotateUserKey(privyUserId: string, key: CryptoKey, accessToken: string): Promise<number> {
  const current = await supabaseProxy.getEncryptionKey(accessToken)
  const keyVersion = ((current.data as EncryptionKeyRow | null)?.key_version ?? 0) + 1
  await storeUserKeyVersion(privyUserId, key, accessToken, keyVersion)
  return keyVersion
}

export async function getUserKey(privyUserId: string, accessToken: string): Promise<CryptoKey | null> {
  const keyResult = await supabaseProxy.getEncryptionKey(accessToken)
  const keyRow = keyResult.data as EncryptionKeyRow | null

  if (!keyRow?.encrypted_key_blob) {
    return null
  }

  const wrappingKey = await deriveWrappingKey(privyUserId)
  return importEncryptedKey(keyRow.encrypted_key_blob, wrappingKey)
}

export async function getOrCreateUserKey(privyUserId: string, accessToken: string): Promise<CryptoKey> {
  const cached = userKeyPromiseCache.get(privyUserId)
  if (cached) {
    return cached
  }

  const promise = (async () => {
    const existing = await getUserKey(privyUserId, accessToken)

    if (existing) {
      return existing
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

    await storeUserKey(privyUserId, key, accessToken)
    return key
  })()

  userKeyPromiseCache.set(privyUserId, promise)

  try {
    return await promise
  } catch (error) {
    userKeyPromiseCache.delete(privyUserId)
    throw error
  }
}
