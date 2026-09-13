import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-lg bg-secondary/60', className)} {...props} />
}

function SkeletonCard() {
  return (
    <div className="break-inside-avoid overflow-hidden rounded-xl border border-vault-border bg-vault-surface shadow-soft">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

function SkeletonAlbum() {
  return (
    <div className="overflow-hidden rounded-xl border border-vault-border bg-vault-surface">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-vault-border bg-vault-surface p-4">
      <Skeleton className="h-12 w-12 flex-shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export { Skeleton, SkeletonCard, SkeletonAlbum, SkeletonRow }
