'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useEncryption } from '@/hooks/useEncryption'
import { restoreFile as restoreFileService } from '@/lib/restore/restoreService'
import type { BackupRecord } from '@/types'

export function useRestore(): {
  restoreFile: (backup: BackupRecord) => Promise<void>
  isRestoring: boolean
  progress: number
  error: Error | null
} {
  const { cryptoKey, isReady, error: encryptionError } = useEncryption()
  const [isRestoring, setIsRestoring] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<Error | null>(null)

  const restoreFile = async (backup: BackupRecord) => {
    if (!isReady || !cryptoKey) {
      const nextError = encryptionError ?? new Error('Encryption key is not ready yet')
      setError(nextError)
      toast.error(nextError.message)
      throw nextError
    }

    setIsRestoring(true)
    setError(null)
    setProgress(0)

    try {
      await restoreFileService(backup, cryptoKey, setProgress)
      toast.success(`Restored ${backup.originalFilename ?? 'file'}`)
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error('Failed to restore file')
      setError(nextError)
      toast.error(nextError.message)
      throw nextError
    } finally {
      setIsRestoring(false)
    }
  }

  return {
    restoreFile,
    isRestoring,
    progress,
    error,
  }
}
