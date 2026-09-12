'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderHeart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function GalleryPermissionBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if browser supports File System Access API
    const isSupported = typeof window !== 'undefined' && 'showOpenFilePicker' in window
    
    // Check if user has previously dismissed this banner
    const isDismissed = localStorage.getItem('vaultly_fs_permission_dismissed') === 'true'

    if (isSupported && !isDismissed) {
      setIsVisible(true)
    }
  }, [])

  const handleRequestPermission = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        await (window as any).showDirectoryPicker()
      } else if ('showOpenFilePicker' in window) {
        await (window as any).showOpenFilePicker()
      }
      // Save state and hide banner upon successful interaction
      localStorage.setItem('vaultly_fs_permission_dismissed', 'true')
      setIsVisible(false)
    } catch (err) {
      console.warn('Native permission request skipped or declined:', err)
      // Hide banner anyway to avoid pestering the user
      setIsVisible(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('vaultly_fs_permission_dismissed', 'true')
    setIsVisible(false)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-6 left-4 right-4 z-40 mx-auto max-w-xl md:left-auto"
        >
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#222222] bg-[#111111]/90 backdrop-blur-md p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FolderHeart className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">📁 Allow photo access</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  Grant permission to your local directory for faster uploads.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={handleRequestPermission}
                className="bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold px-4 py-1.5 rounded-lg"
              >
                Allow
              </Button>
              <button
                onClick={handleDismiss}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-[#222222] hover:text-foreground transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
