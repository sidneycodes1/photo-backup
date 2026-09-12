'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Cloud, FileImage, Loader2, Lock, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useUploadStore } from '@/store/uploadStore'
import { formatBytes } from '@/lib/utils/format'
import type { UploadQueueItem } from '@/types'

function getOverallProgress(item: UploadQueueItem): number {
  if (item.status === 'done') return 100
  if (item.status === 'error') return 0
  if (item.status === 'encrypting') return Math.min(50, item.encryptProgress * 0.5)
  if (item.status === 'uploading') return Math.min(100, 50 + item.uploadProgress * 0.5)
  return 0
}

export function UploadProgress() {
  const uploadQueue = useUploadStore((state) => state.uploadQueue)
  const [isMinimized, setIsMinimized] = useState(false)

  const isProcessing = uploadQueue.some((item) => item.status === 'encrypting' || item.status === 'uploading')

  useEffect(() => {
    if (uploadQueue.length === 0) {
      setIsMinimized(false)
    }
  }, [uploadQueue.length])

  if (uploadQueue.length === 0 || isMinimized || !isProcessing) {
    return null
  }

  const totalFiles = uploadQueue.length
  const completedFiles = uploadQueue.filter((item) => item.status === 'done').length
  const encryptingFiles = uploadQueue.filter((item) => item.status === 'encrypting').length
  const uploadingFiles = uploadQueue.filter((item) => item.status === 'uploading').length

  const totalSize = uploadQueue.reduce((sum, item) => sum + item.file.size, 0)
  const processedBytes = uploadQueue.reduce((sum, item) => {
    if (item.status === 'done') return sum + item.file.size
    if (item.status === 'uploading') return sum + (item.file.size * (50 + item.uploadProgress * 0.5)) / 100
    if (item.status === 'encrypting') return sum + (item.file.size * item.encryptProgress * 0.5) / 100
    return sum
  }, 0)

  const overallProgress = totalSize > 0 ? Math.min(100, (processedBytes / totalSize) * 100) : 0
  const isEncrypting = encryptingFiles > 0
  const isUploading = uploadingFiles > 0 && encryptingFiles === 0

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-vault-border bg-vault-surface p-7 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-vault-text">
            Uploading {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
          </h2>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="text-vault-text-muted transition-colors hover:text-vault-text"
            aria-label="Close upload progress"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-2 flex justify-between text-sm">
          <span className={`flex items-center gap-1.5 ${isEncrypting ? 'text-vault-warning' : 'text-vault-text-muted'}`}>
            <Lock className="h-3.5 w-3.5" />
            {isEncrypting ? 'Encrypting...' : 'Encrypted'}
          </span>
          <span className={`flex items-center gap-1.5 ${isUploading ? 'text-vault-accent' : 'text-vault-text-muted'}`}>
            <Cloud className="h-3.5 w-3.5" />
            {isUploading ? 'Uploading...' : completedFiles === totalFiles ? 'Complete' : 'Waiting...'}
          </span>
        </div>

        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-vault-border">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isEncrypting ? 'bg-vault-warning' : 'bg-vault-accent'}`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        <div className="mb-5 flex justify-between text-sm text-vault-text-muted">
          <span>{formatBytes(processedBytes)} of {formatBytes(totalSize)}</span>
          <span>{Math.round(overallProgress)}%</span>
        </div>

        <div className="mb-6 max-h-56 space-y-3 overflow-y-auto pr-1">
          {uploadQueue.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl border border-vault-border bg-vault-sidebar p-3">
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-vault-border bg-vault-bg">
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-vault-text-muted">
                    <FileImage className="h-5 w-5" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-vault-text">{item.file.name}</p>
                <p className="text-xs text-vault-text-muted">{formatBytes(item.file.size)}</p>
              </div>

              {item.status === 'done' && (
                <Badge className="flex items-center gap-1 border-0 bg-vault-success/10 text-vault-success hover:bg-vault-success/20">
                  <CheckCircle className="h-3 w-3" />
                  Completed
                </Badge>
              )}
              {item.status === 'uploading' && (
                <Badge className="flex items-center gap-1 border-0 bg-vault-accent/10 text-vault-accent hover:bg-vault-accent/20">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Uploading...
                </Badge>
              )}
              {item.status === 'encrypting' && (
                <Badge className="flex items-center gap-1 border-0 bg-vault-warning/10 text-vault-warning hover:bg-vault-warning/20">
                  <Lock className="h-3 w-3" />
                  Encrypting...
                </Badge>
              )}
              {item.status === 'pending' && (
                <Badge className="border-0 bg-vault-border text-vault-text-muted hover:bg-vault-border">
                  Pending
                </Badge>
              )}
              {item.status === 'error' && (
                <Badge className="border-0 bg-vault-error/10 text-vault-error hover:bg-vault-error/20">
                  Failed
                </Badge>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="text-sm text-vault-text-muted transition-colors hover:text-vault-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="rounded-lg bg-vault-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-vault-accent-hover"
          >
            Minimize to tray
          </button>
        </div>
      </div>
    </div>
  )
}
