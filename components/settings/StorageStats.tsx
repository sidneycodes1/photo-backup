import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { StorageStats as StorageStatsProps } from '@/types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / 1024 ** index
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index] ?? 'B'}`
}

export function StorageStats({ totalFiles, totalEncryptedSize, totalOriginalSize }: StorageStatsProps) {
  const efficiency = totalOriginalSize > 0 ? Math.min(100, Math.round((totalEncryptedSize / totalOriginalSize) * 100)) : 0

  return (
    <Card className="border-border bg-card">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Storage usage</CardTitle>
          <Badge variant="outline">{totalFiles} files</Badge>
        </div>
        <CardDescription>Vaultly stores only encrypted blobs on decentralized storage and metadata in Supabase.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1 rounded-2xl border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Encrypted</div>
            <div className="text-2xl font-semibold">{formatBytes(totalEncryptedSize)}</div>
          </div>
          <div className="space-y-1 rounded-2xl border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Original</div>
            <div className="text-2xl font-semibold">{formatBytes(totalOriginalSize)}</div>
          </div>
          <div className="space-y-1 rounded-2xl border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Hot storage estimate</div>
            <div className="text-2xl font-semibold">{formatBytes(totalEncryptedSize)}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Encrypted vs original bytes</span>
            <span>{efficiency}%</span>
          </div>
          <Progress value={efficiency} />
        </div>
      </CardContent>
    </Card>
  )
}
