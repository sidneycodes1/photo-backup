'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useInfiniteQuery } from '@tanstack/react-query'
import { supabaseProxy } from '@/lib/api/supabaseProxy'
import { BackupQuerySchema } from '@/lib/validations/backup'
import type { BackupRecord, GalleryMediaFilter, GallerySortOrder } from '@/types'

type UseGalleryOptions = {
  pageSize?: number
  sortOrder?: GallerySortOrder
  mediaFilter?: GalleryMediaFilter
}

export function useGallery(options: UseGalleryOptions = {}) {
  const { ready, authenticated, user, getAccessToken } = usePrivy()
  const validated = BackupQuerySchema.parse({
    pageSize: options.pageSize ?? 20,
    sortOrder: options.sortOrder ?? 'newest',
    mediaFilter: options.mediaFilter ?? 'all',
  })
  const pageSize = validated.pageSize ?? 20
  const sortOrder = validated.sortOrder ?? 'newest'
  const mediaFilter = validated.mediaFilter ?? 'all'

  const query = useInfiniteQuery({
    queryKey: ['gallery', user?.id, pageSize, sortOrder, mediaFilter],
    enabled: ready && authenticated,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }

      const result = await supabaseProxy.getBackups(token, offset, pageSize, {
        sortOrder,
        mediaFilter,
      })
      const items = (result.data ?? []) as BackupRecord[]

      return {
        items,
        nextOffset: offset + items.length,
        hasMore: items.length === pageSize,
      }
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
    staleTime: 30_000,
  })

  const backups = query.data?.pages.flatMap((page) => page.items) ?? []

  return {
    backups,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  }
}
