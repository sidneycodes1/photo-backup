'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { MoreVertical, RefreshCw, Trash2, Share2 } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ShareModal } from '@/components/sharing/ShareModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useThumbnail } from '@/hooks/useThumbnail'
import { deleteBackup } from '@/lib/gallery/deleteService'
import { formatBytes, formatDate } from '@/lib/utils/format'
import type { BackupRecord } from '@/types'

type GalleryItemProps = {
  backup: BackupRecord
  onSelect: (backup: BackupRecord) => void
  onDeleted?: () => void
}

export function GalleryItem({ backup, onSelect, onDeleted }: GalleryItemProps) {
  const { getAccessToken } = usePrivy()
  const { thumbnailUrl, isLoading } = useThumbnail(backup)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

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
      setDeleteOpen(false)
    },
  })

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const mediaTypeLabel = backup.mimeType?.startsWith('video/') ? 'Video' : 'Photo'

  return (
    <>
      <motion.article
        data-thumbnail-target={backup.id}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        whileHover={{ y: -2, boxShadow: 'var(--shadow-medium)' }}
        whileTap={{ scale: 0.98 }}
        className="group relative mb-3 break-inside-avoid overflow-hidden rounded-xl border border-vault-border bg-vault-surface shadow-soft"
      >
        <motion.div
          role="button"
          tabIndex={0}
          aria-label={`Open ${backup.originalFilename ?? 'media'}`}
          onClick={() => onSelect(backup)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(backup)
            }
          }}
          className="relative block w-full text-left"
        >
          <div className="relative overflow-hidden bg-vault-bg">
            {thumbnailUrl ? (
              <motion.img
                src={thumbnailUrl}
                alt={backup.originalFilename ?? 'Vaultly media'}
                initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="h-auto w-full object-cover"
              style={{ transformOrigin: 'center' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center">
                {isLoading ? (
                  <Skeleton className="h-full w-full rounded-none" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center text-vault-text-muted">
                    {backup.mimeType?.startsWith('video/') ? 'Video preview' : 'Image preview'}
                  </div>
                )}
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="absolute left-3 top-3 flex items-center gap-2"
            >
              <Badge variant="secondary" className="border-0 bg-black/60 text-white">
                Locked
              </Badge>
            </motion.div>

            <div className="absolute right-3 top-3">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Open media actions"
                className="h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80"
                onClick={(event) => {
                  event.stopPropagation()
                  setMenuOpen((value) => !value)
                }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.15 }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>

              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={menuOpen ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.95 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute right-0 top-10 z-10 w-44 overflow-hidden rounded-xl border border-vault-border bg-vault-surface p-1 shadow-soft"
              >
                <motion.button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-vault-text hover:bg-vault-surface-hover"
                  onClick={(event) => {
                    event.stopPropagation()
                    setMenuOpen(false)
                    setShareOpen(true)
                  }}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </motion.button>
                <motion.button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-vault-text hover:bg-vault-surface-hover"
                  onClick={(event) => {
                    event.stopPropagation()
                    setMenuOpen(false)
                    onSelect(backup)
                  }}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Restore / Download
                </motion.button>
                <motion.button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-vault-error hover:bg-vault-error/10"
                  onClick={(event) => {
                    event.stopPropagation()
                    setMenuOpen(false)
                    setDeleteOpen(true)
                  }}
                  whileHover={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </motion.button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 text-white"
            >
              <div className="truncate text-sm font-medium">{backup.originalFilename ?? 'Untitled media'}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/80">
                <span>{formatBytes(backup.originalSize ?? 0)}</span>
                <span>-</span>
                <span>{formatDate(backup.createdAt)}</span>
                <span>-</span>
                <span>{mediaTypeLabel}</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.article>

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

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        backup={backup}
      />
    </>
  )
}
