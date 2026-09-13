'use client'

import { usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { Clock, Upload, Trash2, RefreshCw, AlertTriangle } from 'lucide-react'
import { useActivity } from '@/hooks/useActivity'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { VaultTopBar } from '@/components/layout/VaultTopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { formatRelativeTime } from '@/lib/utils/format'
import type { Activity } from '@/types'

function getActivityIcon(type: Activity['type']) {
  switch (type) {
    case 'uploaded': return <Upload className="h-4 w-4 text-vault-accent" />
    case 'deleted': return <Trash2 className="h-4 w-4 text-destructive" />
    case 'restored': return <RefreshCw className="h-4 w-4 text-vault-success" />
    default: return <Clock className="h-4 w-4" />
  }
}

function getActivityLabel(type: Activity['type']) {
  switch (type) {
    case 'uploaded': return 'Uploaded'
    case 'deleted': return 'Deleted'
    case 'restored': return 'Restored'
    default: return 'Activity'
  }
}

export default function ActivityPage() {
  const { ready, authenticated } = usePrivy()
  const { activities, isLoading, error, refetch } = useActivity()

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
        <Card className="w-full max-w-md border-vault-border bg-vault-surface"><CardContent className="p-6"><p className="text-vault-text">Please sign in to view your activity.</p></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="pl-60 pt-16 min-h-screen bg-[#0A0A0A]">
      <Sidebar />
      <div className="px-6 py-6 space-y-6">
        <VaultTopBar onUploadClick={() => {}} onSettingsClick={() => {}} />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-vault-text">Activity</h1><p className="text-sm text-vault-text-muted mt-1">Recent uploads, deletes, and restores</p></div>
          <Button variant="outline" onClick={() => void refetch()} disabled={isLoading} className="border-vault-border text-vault-text-muted hover:bg-vault-surface-hover"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</Button>
        </motion.div>
        {error && (
          <Card className="border-destructive/20 bg-destructive/5"><CardContent className="flex items-center justify-between p-4"><div className="flex items-center gap-3 text-destructive"><AlertTriangle className="h-5 w-5" /><span className="text-sm">{error.message}</span></div><Button size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button></CardContent></Card>
        )}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : activities.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}>
            <Card className="border-vault-border border-dashed bg-vault-surface">
              <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: 'spring', damping: 15, stiffness: 200 }} className="flex h-20 w-20 items-center justify-center rounded-2xl bg-vault-accent/10">
                  <Clock className="h-9 w-9 text-vault-accent" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }} className="space-y-2">
                  <h2 className="text-lg font-medium text-vault-text">No activity yet</h2>
                  <p className="max-w-md text-sm text-vault-text-muted">Your recent uploads, deletes, and restores will appear here.</p>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <motion.div key={`${activity.backupId}-${activity.timestamp}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04, duration: 0.25 }}>
                <Card className="border-vault-border bg-vault-surface">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-vault-bg">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-vault-text">{activity.filename}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-vault-bg text-vault-text-muted">{getActivityLabel(activity.type)}</span>
                      </div>
                      <p className="text-xs text-vault-text-muted mt-1">{formatRelativeTime(activity.timestamp)}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
