'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Lock, Upload } from 'lucide-react'
import { GalleryItem } from '@/components/gallery/GalleryItem'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils/format'
import type { BackupRecord } from '@/types'

type GalleryGridProps = {
  backups: BackupRecord[]
  isLoading: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
  onSelectBackup: (backup: BackupRecord) => void
  onUploadClick?: () => void
}

type GroupedBackups = Array<{
  label: string
  items: BackupRecord[]
}>

function LoadingCard() {
  return (
    <div className="break-inside-avoid overflow-hidden rounded-2xl border border-vault-border bg-vault-surface shadow-soft">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

function groupByDate(backups: BackupRecord[]): GroupedBackups {
  const groups = new Map<string, BackupRecord[]>()

  backups.forEach((backup) => {
    const label = formatDate(backup.createdAt)
    const items = groups.get(label) ?? []
    items.push(backup)
    groups.set(label, items)
  })

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

export function GalleryGrid({
  backups,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRefresh,
  onSelectBackup,
  onUploadClick,
}: GalleryGridProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const groups = useMemo(() => groupByDate(backups), [backups])

  useEffect(() => {
    if (!hasNextPage || !onLoadMore || isFetchingNextPage) {
      return undefined
    }

    const target = sentinelRef.current
    if (!target) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore()
        }
      },
      { rootMargin: '300px' },
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  if (isLoading) {
    return (
      <div className="columns-2 gap-3 md:columns-3 lg:columns-4 xl:columns-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <LoadingCard key={index} />
        ))}
      </div>
    )
  }

  if (backups.length === 0) {
    return (
      <Card className="border-vault-border border-dashed bg-vault-surface">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-vault-accent/10">
            <Lock className="h-9 w-9 text-vault-accent" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-vault-text">Your vault is empty</h2>
            <p className="max-w-md text-sm text-vault-text-muted">
              Upload your first photos to get started. They will be encrypted on-device before they ever leave your device.
            </p>
          </div>
          <Button
            type="button"
            onClick={onUploadClick}
            className="bg-vault-accent text-white hover:bg-vault-accent-hover"
            disabled={!onUploadClick}
          >
            <Upload className="h-4 w-4" />
            Upload Photos
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group, index) => (
        <section key={group.label}>
          <h2 className="mb-3 mt-6 text-sm font-medium text-vault-text-muted first:mt-0">
            {group.label} <span className="text-vault-border-strong">({group.items.length})</span>
          </h2>
          <div className="columns-2 gap-3 md:columns-3 lg:columns-4 xl:columns-5">
            {group.items.map((backup) => (
              <GalleryItem
                key={backup.id}
                backup={backup}
                onSelect={onSelectBackup}
                onDeleted={onRefresh}
              />
            ))}
          </div>

          {index === groups.length - 1 ? (
            <div ref={sentinelRef} className="flex items-center justify-center py-4 text-sm text-vault-text-muted">
              {isFetchingNextPage ? 'Loading more encrypted media...' : hasNextPage ? 'Scroll to load more' : 'End of vault'}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  )
}
