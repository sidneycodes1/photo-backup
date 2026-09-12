'use client'

import { useQuery } from '@tanstack/react-query'
import { usePrivy } from '@privy-io/react-auth'
import { supabaseProxy } from '@/lib/api/supabaseProxy'
import type { Activity } from '@/types'

export function useActivity() {
  const { ready, authenticated, getAccessToken } = usePrivy()

  const query = useQuery({
    queryKey: ['activity'],
    enabled: ready && authenticated,
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      const result = await supabaseProxy.getActivity(token)
      return result.data as Activity[]
    },
  })

  return {
    activities: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
