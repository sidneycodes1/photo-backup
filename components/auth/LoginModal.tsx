'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Lock, Mail, Chrome } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      };
      
      window.addEventListener('keydown', handleKeyDown)
      
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusableElements && focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus()
      }

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        previousFocusRef.current?.focus()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleGoogleLogin = () => {
    login({ loginMethods: ['google'] })
    onClose()
  }

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    login({ loginMethods: ['email'] })
    onClose()
  }

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
      />

      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        ref={modalRef}
        className="relative z-10 w-full max-w-[380px] overflow-hidden rounded-2xl border border-[#222222] bg-[#111111] p-6 shadow-2xl"
      >
        <motion.button 
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-[#222222] hover:text-foreground transition-colors"
          aria-label="Close login modal"
          whileTap={{ scale: 0.9 }}
        >
          <X className="h-4 w-4" />
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="flex flex-col items-center text-center mt-3 mb-6"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', damping: 15, stiffness: 200 }}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3"
          >
            <Lock className="h-5 w-5" />
          </motion.div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Sign in to Vaultly</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Access your encrypted photo backups
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="space-y-4"
        >
<Button
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full h-11 justify-center gap-2.5 border-[#222222] hover:bg-[#1A1A1A] transition-colors"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <Chrome className="h-4.5 w-4.5 text-primary" />
            <span>Continue with Google</span>
          </Button>

          <div className="relative flex items-center py-1">
            <div className="h-px flex-1 bg-[#222222]" />
            <span className="px-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">or</span>
            <div className="h-px flex-1 bg-[#222222]" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 bg-background/50 border-[#222222] focus-visible:ring-primary/20 focus-visible:border-primary/50 text-sm"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/95 transition-all font-medium"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              Send magic link
            </Button>
          </form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="mt-6 text-center"
        >
          <p className="text-[10px] text-muted-foreground leading-normal">
            Your files are encrypted on-device.
            <br />
            We never see your photos.
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
