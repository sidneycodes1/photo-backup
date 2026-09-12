'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { UploadZone } from './UploadZone'

interface UploadSheetProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
}

export function UploadSheet({ isOpen, onClose, onComplete }: UploadSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null)

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
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop with transition */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom Sheet Card */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            ref={containerRef}
            className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-vault-border bg-vault-surface p-6 pb-8 shadow-2xl scrollbar-thin"
          >
            {/* Top close handle / drag representation */}
            <div className="mx-auto mb-5 h-1.5 w-12 cursor-pointer rounded-full bg-vault-border transition-colors hover:bg-vault-border-strong" onClick={onClose} />

            {/* Header / Dismiss */}
            <button
              onClick={onClose}
              className="absolute right-6 top-6 rounded-full p-1.5 text-vault-text-muted transition-colors hover:bg-vault-surface-hover hover:text-vault-text"
              aria-label="Close upload panel"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {/* Content: UploadZone */}
            <div className="mt-2">
              <UploadZone onComplete={onComplete} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
