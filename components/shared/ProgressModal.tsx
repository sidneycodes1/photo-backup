'use client'

import { motion } from 'framer-motion'
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
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
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
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
