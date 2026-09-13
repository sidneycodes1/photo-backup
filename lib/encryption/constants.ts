export const CHUNK_SIZE = 20 * 1024 * 1024
export const AES_GCM_ALGORITHM = 'AES-GCM' as const
export const AES_GCM_KEY_LENGTH = 256
export const AES_KW_ALGORITHM = 'AES-KW' as const
export const AES_GCM_IV_LENGTH = 12
export const AES_GCM_TAG_LENGTH = 16
export const PBKDF2_ITERATIONS = 600_000
export const PBKDF2_HASH = 'SHA-256' as const
// Random per-vault salt for the passphrase-derived wrapping key (stored
// server-side as plaintext next to the wrapped blob; salts are not secret).
export const PASSPHRASE_SALT_LENGTH = 16
export const PASSPHRASE_MIN_LENGTH = 12
export const LARGE_CHUNK_HEADER_SIZE = AES_GCM_IV_LENGTH + 4
