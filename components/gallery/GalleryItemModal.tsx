'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { usePrivy } from '@privy-io/react-auth'
import { CopyButton } from '@/components/shared/CopyButton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ProgressModal } from '@/components/shared/ProgressModal'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { deleteBackup } from '@/lib/gallery/deleteService'
import { decryptFile } from '@/lib/encryption'
import { fetchWithRetry } from '@/lib/lighthouse/retrieve'
import { formatBytes } from '@/lib/utils/format'
import { useEncryption } from '@/hooks/useEncryption'
import { useRestore } from '@/hooks/useRestore'
import type { BackupRecord } from '@/types'

type GalleryItemModalProps = {
  backup: BackupRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function GalleryItemModal({ backup, open, onOpenChange, onDeleted }: GalleryItemModalProps) {
  const { getAccessToken } = usePrivy()
  const { cryptoKey, isReady } = useEncryption()
  const { restoreFile, isRestoring, progress, error: restoreError } = useRestore()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const previewQuery = useQuery({
    queryKey: ['gallery-preview', backup.id, backup.cid, backup.iv],
    enabled: open && isReady && Boolean(cryptoKey),
    queryFn: async () => {
      if (!cryptoKey) {
        throw new Error('Encryption key is not ready')
      }

      const encryptedBlob = await fetchWithRetry(backup.cid)
      return decryptFile(encryptedBlob, cryptoKey, backup.iv, backup.mimeType ?? 'application/octet-stream')
    },
    staleTime: Infinity,
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      return deleteBackup(backup.id, token)
    },
    onSuccess: () => {
      onDeleted?.()
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (!previewQuery.data) {
      setPreviewUrl(null)
      return undefined
    }

    const objectUrl = URL.createObjectURL(previewQuery.data)
    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [previewQuery.data])

  const fileTypeLabel = backup.mimeType?.startsWith('video/') ? 'Video' : 'Photo'
  const previewStatus = previewQuery.isLoading ? 'Decrypting preview' : previewQuery.error ? 'Preview unavailable' : 'Preview ready'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[92vh] max-w-6xl flex-col overflow-hidden border-vault-border bg-vault-surface p-0">
          <div className="grid flex-1 grid-rows-[auto,1fr] gap-0 lg:grid-cols-[1.5fr,0.85fr] lg:grid-rows-1">
            <div className="relative flex min-h-[40vh] items-center justify-center border-b border-vault-border bg-black lg:border-b-0 lg:border-r">
              {previewQuery.isLoading ? (
                <Skeleton className="h-full w-full rounded-none bg-neutral-900" />
              ) : previewUrl ? (
                backup.mimeType?.startsWith('video/') ? (
                  <video
                    src={previewUrl}
                    controls
                    autoPlay={false}
                    playsInline
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <img src={previewUrl} alt={backup.originalFilename ?? 'Vaultly media'} className="h-full w-full object-contain" />
                )
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center text-sm text-vault-text-muted">
                  <p>{previewStatus}</p>
                  {previewQuery.error ? <p>Try downloading the file to inspect it locally.</p> : null}
                </div>
              )}
            </div>

            <div className="flex flex-col overflow-hidden">
              <DialogHeader className="border-b border-vault-border px-6 py-5">
                <DialogTitle className="text-vault-text">
                  {backup.originalFilename ?? 'Untitled media'}
                </DialogTitle>
                <DialogDescription className="text-vault-text-muted">
                  {fileTypeLabel} | {formatDate(backup.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-vault-border bg-vault-sidebar p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-vault-text-muted">Original</div>
                    <div className="mt-1 font-medium text-vault-text">{formatBytes(backup.originalSize ?? 0)}</div>
                  </div>
                  <div className="rounded-xl border border-vault-border bg-vault-sidebar p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-vault-text-muted">Encrypted</div>
                    <div className="mt-1 font-medium text-vault-text">{formatBytes(backup.encryptedSize ?? 0)}</div>
                  </div>
                  <div className="rounded-xl border border-vault-border bg-vault-sidebar p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-vault-text-muted">CID</div>
                    <div className="mt-1 break-all font-mono text-xs text-vault-text">{backup.cid}</div>
                  </div>
                  <div className="rounded-xl border border-vault-border bg-vault-sidebar p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-vault-text-muted">Media type</div>
                    <div className="mt-1 font-medium text-vault-text">{fileTypeLabel}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium text-vault-text">Details</div>
                  <div className="space-y-2 rounded-xl border border-vault-border bg-vault-sidebar p-4 text-sm text-vault-text-muted">
                    <div className="flex items-center justify-between gap-4">
                      <span>Backup ID</span>
                      <CopyButton value={backup.id} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Status</span>
                      <Badge variant="outline" className="border-vault-border text-vault-text-muted">
                        {previewStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-vault-border px-6 py-5">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="text-sm text-vault-text-muted transition-colors hover:text-vault-text"
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-vault-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-vault-accent-hover"
                    onClick={() => {
                      void restoreFile(backup)
                    }}
                    disabled={isRestoring}
                  >
                    {isRestoring ? 'Restoring...' : 'Restore / Download'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProgressModal
        open={isRestoring}
        title="Restoring backup"
        message={backup.originalFilename ?? 'Preparing your encrypted file'}
        progress={progress}
        statusText={restoreError?.message ?? undefined}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this backup?"
        description="Only the metadata row is removed. The encrypted file remains on decentralized storage."
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteMutation.mutateAsync()
        }}
      />
    </>
  )
}
