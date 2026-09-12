'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'

type ProgressModalProps = {
  open: boolean
  title: string
  message: string
  progress: number
  statusText?: string
}

export function ProgressModal({ open, title, message, progress, statusText }: ProgressModalProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Progress value={Math.max(0, Math.min(100, progress))} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{statusText ?? 'Working...'}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
