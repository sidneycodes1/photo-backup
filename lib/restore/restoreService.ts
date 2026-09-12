import { decryptFile } from '@/lib/encryption'
import { fetchWithRetry } from '@/lib/lighthouse/retrieve'
import { RestoreRequestSchema } from '@/lib/validations/backup'
import type { BackupRecord } from '@/types'

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 1_000)
}

export async function restoreFile(
  backup: BackupRecord,
  key: CryptoKey,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const parsed = RestoreRequestSchema.safeParse({
    backupId: backup.id,
    cid: backup.cid,
    iv: backup.iv,
    mimeType: backup.mimeType ?? 'application/octet-stream',
    originalFilename: backup.originalFilename,
    thumbnailCid: backup.thumbnailCid,
  })

  if (!parsed.success) {
    throw new Error('Invalid backup metadata')
  }

  if (!backup.cid.trim()) {
    throw new Error('Backup CID is required for restore')
  }

  onProgress?.(0)
  const encryptedBlob = await fetchWithRetry(backup.cid)
  onProgress?.(35)

  const decryptedBlob = await decryptFile(
    encryptedBlob,
    key,
    backup.iv,
    backup.mimeType ?? 'application/octet-stream',
    (pct) => {
      const mapped = 35 + Math.round(pct * 0.6)
      onProgress?.(Math.min(95, mapped))
    },
  )

  triggerBrowserDownload(decryptedBlob, backup.originalFilename ?? `vaultly-${backup.id}`)
  onProgress?.(100)
}
