'use client'

import { useQuery } from '@tanstack/react-query'
import { usePrivy } from '@privy-io/react-auth'
import { supabaseProxy } from '@/lib/api/supabaseProxy'

const PLAN_STORAGE_BYTES = 1_099_511_627_776

function formatStorageBytes(bytes: number): string {
  if (bytes === 0) return '0 GB'

  const gb = bytes / 1_073_741_824
  if (gb < 1) {
    return `${gb.toFixed(1)} GB`
  }

  const tb = bytes / 1_099_511_627_776
  if (tb >= 1) {
    return `${tb.toFixed(1)} TB`
  }

  return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`
}

type BackupStorageRow = {
  encrypted_size: number | null
  original_size: number | null
  mime_type: string | null
}

export function useStorageStats() {
  const { user, getAccessToken } = usePrivy()

  const query = useQuery({
    queryKey: ['storage-stats', user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: 30_000,
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }
      const result = await supabaseProxy.getStorageStats(token)
      const rows = (result.data ?? []) as BackupStorageRow[]
      const totalEncryptedBytes = rows.reduce((sum, row) => sum + (row.encrypted_size ?? 0), 0)
      const totalOriginalBytes = rows.reduce((sum, row) => sum + (row.original_size ?? 0), 0)
      const totalFiles = rows.length
      const photoCount = rows.filter((row) => row.mime_type?.startsWith('image/')).length
      const videoCount = rows.filter((row) => row.mime_type?.startsWith('video/')).length
      const percentUsed = Math.min((totalEncryptedBytes / PLAN_STORAGE_BYTES) * 100, 100)

      return {
        totalEncryptedBytes,
        totalOriginalBytes,
        totalFiles,
        photoCount,
        videoCount,
        percentUsed,
        planBytes: PLAN_STORAGE_BYTES,
      }
    },
  })

  const data = query.data

  return {
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    totalFiles: data?.totalFiles ?? 0,
    totalEncryptedBytes: data?.totalEncryptedBytes ?? 0,
    totalOriginalBytes: data?.totalOriginalBytes ?? 0,
    photoCount: data?.photoCount ?? 0,
    videoCount: data?.videoCount ?? 0,
    percentUsed: data?.percentUsed ?? 0,
    usedFormatted: formatStorageBytes(data?.totalEncryptedBytes ?? 0),
    planFormatted: formatStorageBytes(data?.planBytes ?? PLAN_STORAGE_BYTES),
    storageLabel: `${formatStorageBytes(data?.totalEncryptedBytes ?? 0)} of ${formatStorageBytes(data?.planBytes ?? PLAN_STORAGE_BYTES)} used`,
  }
}
