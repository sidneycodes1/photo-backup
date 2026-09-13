'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import { Trash2, RefreshCw, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useTrash } from '@/hooks/useTrash'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { VaultTopBar } from '@/components/layout/VaultTopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { formatBytes, formatDate } from '@/lib/utils/format'
import type { BackupRecord } from '@/types'

function getDaysUntilAutoDelete(deletedAt: string | null): number {
  if (!deletedAt) return 30
  const deleted = new Date(deletedAt)
  const now = new Date()
  const daysSinceDeletion = Math.floor((now.getTime() - deleted.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, 30 - daysSinceDeletion)
}

export default function TrashPage() {
  const { ready, authenticated } = usePrivy()
  const { backups, isLoading, error, refetch, restoreBackup, hardDeleteBackup, isRestoring, isHardDeleting } = useTrash()
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false)

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Initializing secure vault...</span>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4">
        <Card className="w-full max-w-md border-vault-border bg-vault-surface">
          <CardHeader><CardTitle className="text-vault-text">Authentication Required</CardTitle><CardDescription className="text-vault-text-muted">Please sign in to access your trash.</CardDescription></CardHeader>
        </Card>
      </div>
    )
  }

  const handleRestore = async () => {
    if (!selectedBackup) return
    try {
      await restoreBackup(selectedBackup.id)
      toast.success('Item restored to your vault')
      setRestoreOpen(false)
      setSelectedBackup(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore item')
    }
  }

  const handleHardDelete = async () => {
    if (!selectedBackup) return
    try {
      await hardDeleteBackup(selectedBackup.id)
      toast.success('Item permanently deleted')
      setHardDeleteOpen(false)
      setSelectedBackup(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete item')
    }
  }

  return (
    <div className="pl-60 pt-16 min-h-screen bg-[#0A0A0A]">
      <Sidebar />
      <div className="px-6 py-6 space-y-6">
        <VaultTopBar onUploadClick={() => {}} onSettingsClick={() => {}} />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-vault-text">Trash</h1><p className="text-sm text-vault-text-muted mt-1">Items in trash are permanently deleted after 30 days</p></div>
          <Button variant="outline" onClick={() => void refetch()} disabled={isLoading} className="border-vault-border text-vault-text-muted hover:bg-vault-surface-hover"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</Button>
        </motion.div>
        {error && (
          <Card className="border-destructive/20 bg-destructive/5"><CardContent className="flex items-center justify-between p-4"><div className="flex items-center gap-3 text-destructive"><AlertTriangle className="h-5 w-5" /><span className="text-sm">{error.message}</span></div><Button size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button></CardContent></Card>
        )}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="aspect-[4/3] w-full rounded-xl" />)}
          </div>
        ) : backups.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}>
            <Card className="border-vault-border border-dashed bg-vault-surface">
              <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: 'spring', damping: 15, stiffness: 200 }} className="flex h-20 w-20 items-center justify-center rounded-2xl bg-vault-accent/10">
                  <Trash2 className="h-9 w-9 text-vault-accent" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }} className="space-y-2">
                  <h2 className="text-lg font-medium text-vault-text">Trash is empty</h2>
                  <p className="max-w-md text-sm text-vault-text-muted">Items you delete will appear here for 30 days before permanent deletion.</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.3 }}>
                  <Button variant="outline" onClick={() => void refetch()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>Browse Gallery</Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {backups.map((backup, index) => {
              const daysLeft = getDaysUntilAutoDelete(backup.deletedAt)
              return (
                <motion.div key={backup.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04, duration: 0.25 }}>
                  <Card className="border-vault-border bg-vault-surface">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-vault-bg overflow-hidden">
                        {backup.thumbnailCid ? <img src={`https://gateway.lighthouse.storage/ipfs/${backup.thumbnailCid}`} alt={backup.originalFilename ?? 'Thumbnail'} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-vault-text-muted text-xs">{backup.mimeType?.startsWith('video/') ? 'Video' : 'Image'}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-vault-text truncate">{backup.originalFilename ?? 'Untitled'}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-vault-text-muted"><span>{formatBytes(backup.originalSize ?? 0)}</span><span>•</span><span>{formatDate(backup.deletedAt ?? backup.createdAt)}</span></div>
                        <div className="flex items-center gap-2 mt-2 text-xs"><Clock className="h-3 w-3 text-vault-accent" /><span className={daysLeft <= 7 ? 'text-destructive' : 'text-vault-text-muted'}>Auto-deletes in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setSelectedBackup(backup); setRestoreOpen(true) }} disabled={isRestoring} className="border-vault-border text-vault-text hover:bg-vault-surface-hover" whileTap={{ scale: 0.95 }}><RefreshCw className="h-4 w-4" /> Restore</Button>
                        <Button size="sm" variant="outline" onClick={() => { setSelectedBackup(backup); setHardDeleteOpen(true) }} disabled={isHardDeleting} className="border-destructive/20 text-destructive hover:bg-destructive/10" whileTap={{ scale: 0.95 }}><Trash2 className="h-4 w-4" /> Delete Forever</Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
      <ConfirmDialog open={restoreOpen} onOpenChange={setRestoreOpen} title="Restore this item?" description="This will restore the item to your main vault." confirmLabel="Restore" onConfirm={handleRestore} />
      <ConfirmDialog open={hardDeleteOpen} onOpenChange={setHardDeleteOpen} title="Permanently delete this item?" description="This action cannot be undone. The encrypted file will remain on decentralized storage, but all metadata will be removed." confirmLabel="Delete Forever" onConfirm={handleHardDelete} />
    </div>
  )
}
