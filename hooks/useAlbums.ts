'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePrivy } from '@privy-io/react-auth'
import { supabaseProxy } from '@/lib/api/supabaseProxy'
import type { Album, BackupRecord } from '@/types'

export function useAlbums() {
  const { ready, authenticated, getAccessToken } = usePrivy()
  const queryClient = useQueryClient()

  const albumsQuery = useQuery({
    queryKey: ['albums'],
    enabled: ready && authenticated,
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      const result = await supabaseProxy.listAlbums(token)
      return result.data as Album[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      return supabaseProxy.createAlbum(token, name)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] })
    },
  })

  const addToAlbumMutation = useMutation({
    mutationFn: async ({ albumId, backupId }: { albumId: string; backupId: string }) => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      return supabaseProxy.addToAlbum(token, albumId, backupId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      queryClient.invalidateQueries({ queryKey: ['album-backups'] })
    },
  })

  const removeFromAlbumMutation = useMutation({
    mutationFn: async ({ albumId, backupId }: { albumId: string; backupId: string }) => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      return supabaseProxy.removeFromAlbum(token, albumId, backupId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      queryClient.invalidateQueries({ queryKey: ['album-backups'] })
    },
  })

  return {
    albums: albumsQuery.data ?? [],
    isLoading: albumsQuery.isLoading,
    error: albumsQuery.error,
    refetch: albumsQuery.refetch,
    createAlbum: createMutation.mutateAsync,
    addToAlbum: addToAlbumMutation.mutateAsync,
    removeFromAlbum: removeFromAlbumMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isAdding: addToAlbumMutation.isPending,
    isRemoving: removeFromAlbumMutation.isPending,
  }
}

export function useAlbumBackups(albumId: string | null) {
  const { ready, authenticated, getAccessToken } = usePrivy()

  return useQuery({
    queryKey: ['album-backups', albumId],
    enabled: ready && authenticated && Boolean(albumId),
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token || !albumId) {
        throw new Error('Missing token or albumId')
      }
      const result = await supabaseProxy.getAlbumBackups(token, albumId)
      return result.data as BackupRecord[]
    },
  })
}
