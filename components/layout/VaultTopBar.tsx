'use client'

import { LayoutGrid, Settings, Shield, Upload } from 'lucide-react'
import { useStorageStats } from '@/hooks/useStorageStats'

interface VaultTopBarProps {
  onUploadClick: () => void
  onSettingsClick: () => void
  title?: string
}

export function VaultTopBar({ onUploadClick, onSettingsClick, title = 'Photos' }: VaultTopBarProps) {
  const { storageLabel, percentUsed, totalFiles, isLoading } = useStorageStats()

  return (
    <header className="fixed left-60 right-0 top-0 z-10 flex h-16 items-center justify-between border-b border-vault-border bg-vault-bg px-6">
      <div className="select-none">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-vault-text">
          {title}
          <Shield className="h-5 w-5 text-vault-accent" />
        </h1>
        <p className="text-sm text-vault-text-muted">{isLoading ? '...' : `${totalFiles.toLocaleString()} items`}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-3 md:flex">
          <Shield className="h-4 w-4 text-vault-text-muted" />
          <span className="text-sm text-vault-text-muted">{isLoading ? '...' : storageLabel}</span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-vault-border">
            <div className="h-full rounded-full bg-vault-accent transition-all" style={{ width: `${percentUsed}%` }} />
          </div>
          <span className="text-sm font-medium text-vault-text">{isLoading ? '' : `${Math.round(percentUsed)}%`}</span>
        </div>

        <button
          type="button"
          onClick={onUploadClick}
          className="ml-4 flex items-center gap-2 rounded-lg bg-vault-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vault-accent-hover"
        >
          <Upload className="h-4 w-4" />
          Upload
        </button>

        <div className="ml-2 flex items-center gap-1">
          <button type="button" className="rounded-lg bg-vault-surface-hover p-2 text-vault-text transition-colors">
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onSettingsClick}
            className="rounded-lg p-2 text-vault-text-muted transition-colors hover:bg-vault-surface-hover hover:text-vault-text"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
