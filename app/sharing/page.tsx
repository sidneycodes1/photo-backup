'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { Share2, Copy, Trash2, RefreshCw, AlertTriangle, Clock, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useSharing } from '@/hooks/useSharing'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { VaultTopBar } from '@/components/layout/VaultTopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { formatDate, formatRelativeTime } from '@/lib/utils/format'
import type { Share } from '@/types'

export default function SharingPage() {
  const { ready, authenticated } = usePrivy()
  const { shares, isLoading, error, refetch, revokeShare, isRevoking } = useSharing()
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null)

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
          <CardContent className="p-6">
            <p className="text-vault-text">Please sign in to manage your shares.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleCopyLink = (share: Share) => {
    const shareUrl = `${window.location.origin}/share/${share.id}`
    navigator.clipboard.writeText(shareUrl)
    setCopiedShareId(share.id)
    toast.success('Share link copied to clipboard')
    setTimeout(() => setCopiedShareId(null), 2000)
  }

  const handleRevokeShare = async (shareId: string) => {
    try {
      await revokeShare(shareId)
      toast.success('Share revoked')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke share')
    }
  }

  return (
    <div className="pl-60 pt-16 min-h-screen bg-[#0A0A0A]">
      <Sidebar />
      <div className="px-6 py-6 space-y-6">
        <VaultTopBar
          onUploadClick={() => {}}
          onSettingsClick={() => {}}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-vault-text">Secure Sharing</h1>
            <p className="text-sm text-vault-text-muted mt-1">
              Share encrypted files with expiring links
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="border-vault-border text-vault-text-muted hover:bg-vault-surface-hover"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">{error.message}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : shares.length === 0 ? (
          <Card className="border-vault-border border-dashed bg-vault-surface">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-vault-accent/10">
                <Share2 className="h-9 w-9 text-vault-accent" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-medium text-vault-text">No active shares</h2>
                <p className="max-w-md text-sm text-vault-text-muted">
                  Share links you create will appear here. Each link expires after a set time.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {shares.map((share) => {
              const isExpired = new Date(share.expiresAt) < new Date()
              const timeRemaining = formatRelativeTime(share.expiresAt)
              
              return (
                <Card key={share.id} className={`border-vault-border bg-vault-surface ${isExpired ? 'opacity-50' : ''}`}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vault-bg">
                      <LinkIcon className="h-6 w-6 text-vault-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-vault-text truncate">
                          {share.originalFilename ?? 'Shared file'}
                        </span>
                        {isExpired && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-vault-text-muted">
                        <Clock className="h-3 w-3" />
                        <span>{isExpired ? 'Expired' : `Expires ${timeRemaining}`}</span>
                        <span>•</span>
                        <span>Views: {share.viewCount}</span>
                        <span>•</span>
                        <span>Created: {formatDate(share.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyLink(share)}
                        disabled={isExpired}
                        className="border-vault-border text-vault-text hover:bg-vault-surface-hover"
                      >
                        {copiedShareId === share.id ? (
                          <span className="text-vault-success">Copied!</span>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy Link
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevokeShare(share.id)}
                        disabled={isRevoking}
                        className="border-destructive/20 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
