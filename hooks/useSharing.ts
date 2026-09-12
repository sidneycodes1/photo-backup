'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePrivy } from '@privy-io/react-auth'
import { supabaseProxy } from '@/lib/api/supabaseProxy'
import type { Share } from '@/types'

export function useSharing() {
  const { ready, authenticated, getAccessToken } = usePrivy()
  const queryClient = useQueryClient()

  const sharesQuery = useQuery({
    queryKey: ['shares'],
    enabled: ready && authenticated,
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      const result = await supabaseProxy.listShares(token)
      return result.data as Share[]
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      return supabaseProxy.revokeShare(token, shareId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] })
    },
  })

  return {
    shares: sharesQuery.data ?? [],
    isLoading: sharesQuery.isLoading,
    error: sharesQuery.error,
    refetch: sharesQuery.refetch,
    revokeShare: revokeMutation.mutateAsync,
    isRevoking: revokeMutation.isPending,
  }
}
