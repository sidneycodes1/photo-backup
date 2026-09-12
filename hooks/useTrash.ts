'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePrivy } from '@privy-io/react-auth'
import { supabaseProxy } from '@/lib/api/supabaseProxy'
import type { BackupRecord } from '@/types'

export function useTrash() {
  const { ready, authenticated, getAccessToken } = usePrivy()
  const queryClient = useQueryClient()

  const trashQuery = useQuery({
    queryKey: ['trash'],
    enabled: ready && authenticated,
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      const result = await supabaseProxy.getTrash(token)
      return result.data as BackupRecord[]
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      return supabaseProxy.restoreBackup(token, backupId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    },
  })

  const hardDeleteMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      return supabaseProxy.hardDeleteBackup(token, backupId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })

  return {
    backups: trashQuery.data ?? [],
    isLoading: trashQuery.isLoading,
    error: trashQuery.error,
    refetch: trashQuery.refetch,
    restoreBackup: restoreMutation.mutateAsync,
    hardDeleteBackup: hardDeleteMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,
    isHardDeleting: hardDeleteMutation.isPending,
  }
}
