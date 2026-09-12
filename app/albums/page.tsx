'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { Plus, FolderOpen, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useAlbums, useAlbumBackups } from '@/hooks/useAlbums'
import { GalleryGrid } from '@/components/gallery/GalleryGrid'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { VaultTopBar } from '@/components/layout/VaultTopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { formatDate } from '@/lib/utils/format'
import type { Album } from '@/types'

export default function AlbumsPage() {
  const { ready, authenticated } = usePrivy()
  const { albums, isLoading, error, refetch, createAlbum, isCreating } = useAlbums()
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newAlbumName, setNewAlbumName] = useState('')

  const albumBackupsQuery = useAlbumBackups(selectedAlbum?.id ?? null)

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
            <p className="text-vault-text">Please sign in to access your albums.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (selectedAlbum) {
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
              <Button
                variant="ghost"
                onClick={() => setSelectedAlbum(null)}
                className="text-vault-text-muted hover:text-vault-text"
              >
                ← Back to Albums
              </Button>
              <h1 className="text-2xl font-bold text-vault-text mt-2">{selectedAlbum.name}</h1>
              <p className="text-sm text-vault-text-muted mt-1">
                {albumBackupsQuery.data?.length ?? 0} items
              </p>
            </div>
          </div>

          <GalleryGrid
            backups={albumBackupsQuery.data ?? []}
            isLoading={albumBackupsQuery.isLoading}
            onSelectBackup={() => {}}
            onUploadClick={() => {}}
            onRefresh={() => void albumBackupsQuery.refetch()}
          />
        </div>
      </div>
    )
  }

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) {
      toast.error('Please enter an album name')
      return
    }
    try {
      await createAlbum(newAlbumName.trim())
      toast.success('Album created')
      setNewAlbumName('')
      setShowCreateDialog(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create album')
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
            <h1 className="text-2xl font-bold text-vault-text">Albums</h1>
            <p className="text-sm text-vault-text-muted mt-1">
              Organize your photos into collections
            </p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-vault-accent text-white hover:bg-vault-accent-hover"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Album
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : albums.length === 0 ? (
          <Card className="border-vault-border border-dashed bg-vault-surface">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-vault-accent/10">
                <FolderOpen className="h-9 w-9 text-vault-accent" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-medium text-vault-text">No albums yet</h2>
                <p className="max-w-md text-sm text-vault-text-muted">
                  Create your first album to organize your photos.
                </p>
              </div>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-vault-accent text-white hover:bg-vault-accent-hover"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Album
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {albums.map((album) => (
              <Card
                key={album.id}
                className="border-vault-border bg-vault-surface cursor-pointer hover:border-vault-accent transition-colors"
                onClick={() => setSelectedAlbum(album)}
              >
                <CardContent className="p-0">
                  <div className="aspect-square bg-vault-bg flex items-center justify-center">
                    <FolderOpen className="h-12 w-12 text-vault-text-muted" />
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-vault-text truncate">{album.name}</p>
                    <p className="text-xs text-vault-text-muted mt-1">{formatDate(album.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {showCreateDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md border-vault-border bg-vault-surface">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-medium text-vault-text">Create New Album</h2>
                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  placeholder="Album name"
                  className="w-full px-3 py-2 rounded-lg border border-vault-border bg-vault-bg text-vault-text placeholder:text-vault-text-muted focus:outline-none focus:border-vault-accent"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false)
                      setNewAlbumName('')
                    }}
                    className="border-vault-border text-vault-text-muted hover:bg-vault-surface-hover"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAlbum}
                    disabled={isCreating || !newAlbumName.trim()}
                    className="bg-vault-accent text-white hover:bg-vault-accent-hover"
                  >
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
