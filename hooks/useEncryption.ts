// Vault encryption hook: exposes the in-memory session key (see
// vaultSession.ts) for encrypt/decrypt, plus the passphrase setup/unlock
// actions. The key is never fetched automatically — the user must unlock (or
// set up) the vault each session, and it is cleared on logout or tab close.
// Trust boundary: same as vaultSession — memory only, never persisted.

'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import {
  decryptFile as decryptVaultFile,
  encryptFile as encryptVaultFile,
  stripExif,
} from '@/lib/encryption'
import { hasUsableVaultKey } from '@/lib/encryption/keyManagement'
import {
  getVaultSessionKey,
  lockVaultSession,
  setupVaultSession,
  subscribeVaultSession,
  unlockVaultSession,
} from '@/lib/encryption/vaultSession'

export type VaultStatus = 'idle' | 'needs-setup' | 'locked' | 'ready'

export function useEncryption() {
  const { ready, authenticated, getAccessToken } = usePrivy()
  const sessionPresent = useSyncExternalStore(
    (notify) => subscribeVaultSession(notify),
    () => getVaultSessionKey() !== null,
    () => false,
  )
  const [probe, setProbe] = useState<'unknown' | 'needs-setup' | 'locked'>('unknown')
  const [error, setError] = useState<Error | null>(null)
  const [isWorking, setIsWorking] = useState(false)

  // The in-memory key belongs to the Privy session: drop it on logout.
  useEffect(() => {
    if (ready && !authenticated) {
      lockVaultSession()
      setProbe('unknown')
      setError(null)
    }
  }, [ready, authenticated])

  // After login with no session key, ask the server whether a wrapped vault
  // key exists (no key material involved) to pick setup vs. unlock mode.
  useEffect(() => {
    let cancelled = false

    if (!ready || !authenticated || getVaultSessionKey()) {
      return () => {
        cancelled = true
      }
    }

    setProbe('unknown')
    setError(null)

    void (async () => {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        setProbe((await hasUsableVaultKey(token)) ? 'locked' : 'needs-setup')
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause : new Error('Failed to check vault status'))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [ready, authenticated, getAccessToken, sessionPresent])

  const vaultStatus: VaultStatus = !ready || !authenticated
    ? 'idle'
    : sessionPresent
      ? 'ready'
      : probe === 'unknown'
        ? 'idle'
        : probe

  const unlock = useCallback(
    async (passphrase: string): Promise<boolean> => {
      setIsWorking(true)
      setError(null)
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('No access token available')
        await unlockVaultSession(passphrase, token)
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause : new Error('Failed to unlock the vault'))
        return false
      } finally {
        setIsWorking(false)
      }
    },
    [getAccessToken],
  )

  const setupVault = useCallback(
    async (passphrase: string, confirmPassphrase: string): Promise<boolean> => {
      setIsWorking(true)
      setError(null)
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('No access token available')
        await setupVaultSession(passphrase, confirmPassphrase, token)
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause : new Error('Failed to set up the vault'))
        return false
      } finally {
        setIsWorking(false)
      }
    },
    [getAccessToken],
  )

  const lock = useCallback(() => {
    lockVaultSession()
    setProbe('unknown')
    setError(null)
  }, [])

  const encryptFile = async (file: File, onProgress?: (pct: number) => void) => {
    const key = getVaultSessionKey()
    if (!key) {
      throw new Error('Vault is locked. Unlock it before encrypting files.')
    }

    const strippedFile = await stripExif(file)
    return encryptVaultFile(strippedFile, key, onProgress)
  }

  const decryptFile = async (encryptedBlob: Blob, ivBase64: string, mimeType: string, onProgress?: (pct: number) => void) => {
    const key = getVaultSessionKey()
    if (!key) {
      throw new Error('Vault is locked. Unlock it before decrypting files.')
    }

    return decryptVaultFile(encryptedBlob, key, ivBase64, mimeType, onProgress)
  }

  return {
    encryptFile,
    decryptFile,
    cryptoKey: sessionPresent ? getVaultSessionKey() : null,
    isReady: sessionPresent,
    vaultStatus,
    unlock,
    setupVault,
    lock,
    isWorking,
    error,
  }
}
