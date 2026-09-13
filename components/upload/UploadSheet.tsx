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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            ref={containerRef}
            className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-vault-border bg-vault-surface p-6 pb-8 shadow-2xl scrollbar-thin"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="mx-auto mb-5 h-1.5 w-12 cursor-pointer rounded-full bg-vault-border transition-colors hover:bg-vault-border-strong"
              onClick={onClose}
            />

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.2 }}
              onClick={onClose}
              className="absolute right-6 top-6 rounded-full p-1.5 text-vault-text-muted transition-colors hover:bg-vault-surface-hover hover:text-vault-text"
              aria-label="Close upload panel"
              whileTap={{ scale: 0.9 }}
            >
              <X className="h-4.5 w-4.5" />
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <UploadZone onComplete={onComplete} />
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
