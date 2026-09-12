'use client'

import { useEffect, useRef, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import {
  decryptFile as decryptVaultFile,
  encryptFile as encryptVaultFile,
  getOrCreateUserKey,
  stripExif,
} from '@/lib/encryption'

type PrivyUserLike = {
  id?: string
}

function getPrivyUserId(user: unknown): string | null {
  if (!user || typeof user !== 'object') {
    return null
  }

  const candidate = user as PrivyUserLike
  return typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : null
}

export function useEncryption() {
  const { ready, authenticated, user, getAccessToken } = usePrivy()
  const keyRef = useRef<CryptoKey | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const privyUserId = getPrivyUserId(user)

  useEffect(() => {
    let cancelled = false

    if (!ready || !authenticated || !privyUserId) {
      keyRef.current = null
      setIsReady(false)
      return () => {
        cancelled = true
      }
    }

    setError(null)
    setIsReady(false)

    void (async () => {
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('No access token available')
        const key = await getOrCreateUserKey(privyUserId, token)

        if (!cancelled) {
          keyRef.current = key
          setIsReady(true)
        }
      } catch (cause) {
        if (!cancelled) {
          const normalizedError = cause instanceof Error ? cause : new Error('Failed to initialize the Vaultly encryption key')
          keyRef.current = null
          setError(normalizedError)
          setIsReady(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authenticated, privyUserId, ready, getAccessToken])

  const encryptFile = async (file: File, onProgress?: (pct: number) => void) => {
    if (!keyRef.current) {
      throw new Error('Encryption key is not ready yet')
    }

    const strippedFile = await stripExif(file)
    return encryptVaultFile(strippedFile, keyRef.current, onProgress)
  }

  const decryptFile = async (encryptedBlob: Blob, ivBase64: string, mimeType: string, onProgress?: (pct: number) => void) => {
    if (!keyRef.current) {
      throw new Error('Encryption key is not ready yet')
    }

    return decryptVaultFile(encryptedBlob, keyRef.current, ivBase64, mimeType, onProgress)
  }

  return {
    encryptFile,
    decryptFile,
    cryptoKey: keyRef.current,
    isReady,
    error,
  }
}
