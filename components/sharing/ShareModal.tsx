'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { usePrivy } from '@privy-io/react-auth'
import { useEncryption } from '@/hooks/useEncryption'
import { createShare } from '@/lib/sharing/shareService'
import { CopyButton } from '@/components/shared/CopyButton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { BackupRecord } from '@/types'

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  backup: BackupRecord
}

const EXPIRY_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 24, label: '1 day' },
  { value: 168, label: '7 days' },
  { value: 720, label: '30 days' },
]

export function ShareModal({ open, onOpenChange, backup }: ShareModalProps) {
  const { getAccessToken } = usePrivy()
  const { cryptoKey } = useEncryption()
  const [expiresInHours, setExpiresInHours] = useState(168)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const createShareMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      if (!cryptoKey) {
        throw new Error('Encryption key not available')
      }
      return createShare({
        backup,
        cryptoKey,
        token,
        expiresInHours,
      })
    },
    onSuccess: (result) => {
      setShareUrl(result.shareUrl)
    },
  })

  const handleCreateShare = () => {
    createShareMutation.mutate()
  }

  const handleClose = () => {
    setShareUrl(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-vault-border bg-vault-surface">
        <DialogHeader>
          <motion.h3
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="text-vault-text"
          >
            Share Securely
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="text-vault-text-muted"
          >
            Create an expiring link to share this file. The recipient doesn&apos;t need a Vaultly account.
          </motion.p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!shareUrl ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.2 }}
                className="space-y-2"
              >
                <label className="text-sm font-medium text-vault-text">Link expires in</label>
                <div className="grid grid-cols-2 gap-2">
                  {EXPIRY_OPTIONS.map((option) => (
                    <motion.button
                      key={option.value}
                      type="button"
                      onClick={() => setExpiresInHours(option.value)}
                      className={`rounded-lg border p-3 text-sm transition-colors ${
                        expiresInHours === option.value
                          ? 'border-vault-accent bg-vault-accent/10 text-vault-text'
                          : 'border-vault-border bg-vault-bg text-vault-text-muted hover:bg-vault-surface-hover'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {option.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.2 }}
              >
                <Button
                  onClick={handleCreateShare}
                  disabled={createShareMutation.isPending}
                  className="w-full bg-vault-accent text-vault-bg hover:bg-vault-accent/90"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {createShareMutation.isPending ? 'Creating link...' : 'Create link'}
                </Button>
              </motion.div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.2 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border border-vault-border bg-vault-bg p-3">
                  <p className="truncate text-sm text-vault-text-muted">{shareUrl}</p>
                </div>
                <CopyButton value={shareUrl} />
              </div>
              <p className="text-xs text-vault-text-muted">
                This link expires in {EXPIRY_OPTIONS.find((o) => o.value === expiresInHours)?.label}. 
                Anyone with the link can view the file.
              </p>
            </motion.div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-vault-border text-vault-text hover:bg-vault-surface-hover"
            whileTap={{ scale: 0.97 }}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
