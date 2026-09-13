'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Settings, Loader2 } from 'lucide-react'
import { StorageStats } from './StorageStats'
import { EncryptionInfo } from './EncryptionInfo'
import { useStorageStats } from '@/hooks/useStorageStats'

interface SettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const { totalFiles, totalEncryptedBytes, totalOriginalBytes, isLoading, error } = useStorageStats()

  const stats =
    !isLoading && !error
      ? {
          totalFiles,
          totalEncryptedSize: totalEncryptedBytes,
          totalOriginalSize: totalOriginalBytes,
        }
      : null

  // Escape key support
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop with transition */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Right Drawer Card */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="relative z-10 w-full max-w-lg border-l border-[#222222] bg-[#111111] p-6 shadow-2xl h-screen overflow-y-auto scrollbar-thin"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#222222]/50 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Settings className="h-4.5 w-4.5" />
                </div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">Vault Settings</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-[#222222] hover:text-foreground transition-colors"
                aria-label="Close settings panel"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Content list */}
            <div className="space-y-6">
              {/* Storage Stats Section */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="space-y-3"
              >
                <h3 className="text-xs uppercase font-mono tracking-widest text-muted-foreground">Storage Overview</h3>
                {isLoading ? (
                  <div className="flex items-center justify-center py-10 border border-[#222222] bg-card rounded-xl">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground ml-2">Loading stats...</span>
                  </div>
                ) : error ? (
                  <div className="p-4 border border-destructive/20 bg-destructive/5 text-destructive rounded-xl text-xs">
                    Failed to fetch storage statistics: {error instanceof Error ? error.message : 'Unknown error'}
                  </div>
                ) : stats ? (
                  <StorageStats
                    totalFiles={stats.totalFiles}
                    totalEncryptedSize={stats.totalEncryptedSize}
                    totalOriginalSize={stats.totalOriginalSize}
                  />
                ) : null}
              </motion.div>

              {/* Encryption Info Section */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="space-y-3"
              >
                <h3 className="text-xs uppercase font-mono tracking-widest text-muted-foreground">Security Standards</h3>
                <EncryptionInfo />
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
