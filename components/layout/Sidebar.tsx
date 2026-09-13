'use client'

import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Activity, Album, Image as ImageIcon, LogOut, Settings, Share2, Shield, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStorageStats } from '@/hooks/useStorageStats'
import { useUserProfile } from '@/hooks/useUserProfile'

const NAV_ITEMS = [
  { href: '/gallery', label: 'Photos', icon: ImageIcon },
  { href: '/albums', label: 'Albums', icon: Album },
  { href: '/sharing', label: 'Secure Sharing', icon: Share2 },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/trash', label: 'Trash', icon: Trash2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { logout } = useAuth()
  const { name, email, initials, avatarUrl } = useUserProfile()
  const { storageLabel, percentUsed, isLoading } = useStorageStats()

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed left-0 top-0 z-20 flex h-screen w-60 flex-col border-r border-vault-border bg-vault-sidebar"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex items-center gap-3 px-5 py-5"
      >
        <Shield className="h-7 w-7 flex-shrink-0 text-vault-accent" />
        <span className="text-lg font-semibold tracking-tight text-vault-text">Vaultly</span>
      </motion.div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }, index) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`)

            return (
              <motion.div key={href} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + index * 0.05, duration: 0.3 }}>
                <motion.a
                  href={href}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                  whileTap={{ scale: 0.98 }}
                  className={[
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'border-l-2 border-vault-accent bg-vault-accent/10 -ml-px pl-[14px] font-medium text-vault-accent'
                      : 'text-vault-text-muted hover:bg-vault-surface-hover hover:text-vault-text',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </motion.a>
              </motion.div>
            )
          })}
        </div>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="space-y-4 border-t border-vault-border px-4 pb-5 pt-4"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-vault-text-muted">Secure Storage</span>
            <span className="text-xs text-vault-text-muted">{isLoading ? '...' : `${Math.round(percentUsed)}%`}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-vault-border">
            <motion.div
              className="h-full rounded-full bg-vault-accent"
              initial={{ width: 0 }}
              animate={{ width: isLoading ? '0%' : `${percentUsed}%` }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          </div>
          <p className="text-xs text-vault-text-muted">{isLoading ? 'Calculating...' : storageLabel}</p>
        </div>

        <motion.button
          type="button"
          whileHover={{ borderColor: 'rgba(99,102,241,0.5)' }}
          whileTap={{ scale: 0.98 }}
          className="w-full rounded-lg border border-vault-border-strong py-2 text-xs text-vault-text-muted transition-colors hover:border-vault-accent hover:text-vault-accent"
        >
          Manage Plan
        </motion.button>

        <motion.div
          className="group flex items-center gap-3"
          whileHover={{ opacity: 0.9 }}
          whileTap={{ scale: 0.98 }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-vault-accent/20">
              <span className="text-xs font-medium text-vault-accent">{initials}</span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-vault-text">{name}</p>
            <p className="truncate text-xs text-vault-text-muted">{email ?? 'No email available'}</p>
          </div>

          <motion.button
            type="button"
            onClick={() => void logout()}
            className="rounded-md p-1 opacity-0 transition-opacity hover:bg-vault-surface-hover group-hover:opacity-100"
            title="Sign out"
            whileTap={{ scale: 0.9 }}
          >
            <LogOut className="h-3.5 w-3.5 text-vault-text-muted" />
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.aside>
  )
}
