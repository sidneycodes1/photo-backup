'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Uppy from '@uppy/core'
import { FolderOpen, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useEncryption } from '@/hooks/useEncryption'
import { supabaseProxy } from '@/lib/api/supabaseProxy'
import { uploadFile, DuplicateFileError } from '@/lib/upload/uploadService'
import { useUploadStore } from '@/store/uploadStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EncryptionBadge } from './EncryptionBadge'

interface UploadZoneProps {
  onFilesReady?: (files: File[]) => void
  onComplete?: () => void
  isUploading?: boolean
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Upload failed'
}

export function UploadZone({ onFilesReady, onComplete, isUploading = false }: UploadZoneProps) {
  const { ready, authenticated, user, getAccessToken } = useAuth()
  const { cryptoKey, isReady, error: encryptionError } = useEncryption()
  const uploadQueue = useUploadStore((state) => state.uploadQueue)
  const addToQueue = useUploadStore((state) => state.addToQueue)
  const updateProgress = useUploadStore((state) => state.updateProgress)
  const clearQueue = useUploadStore((state) => state.clearQueue)

  const [isProcessing, setIsProcessing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const uppyRef = useRef<Uppy | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (uppyRef.current) return undefined

    uppyRef.current = new Uppy({
      autoProceed: false,
      restrictions: {
        allowedFileTypes: ['image/*', 'video/*'],
      },
    })

    return () => {
      uppyRef.current?.destroy()
      uppyRef.current = null
    }
  }, [])

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return

    const accepted = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))
    if (accepted.length === 0) return

    const queuedFiles: File[] = []

    accepted.forEach((file) => {
      try {
        uppyRef.current?.addFile({
          name: file.name,
          type: file.type,
          data: file,
          source: 'Local',
          isRemote: false,
        })
        addToQueue(file)
        queuedFiles.push(file)
      } catch {
        // Duplicate file or rejected file - skip silently.
      }
    })

    if (queuedFiles.length > 0) {
      onFilesReady?.(queuedFiles)
    }
    setLocalError(null)
  }, [addToQueue, onFilesReady])

  const handleClick = useCallback(() => {
    if ('showOpenFilePicker' in window) {
      ;(window as any)
        .showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'Photos and Videos',
              accept: {
                'image/*': ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.gif'],
                'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.m4v'],
              },
            },
          ],
        })
        .then((handles: FileSystemFileHandle[]) => {
          Promise.all(handles.map((handle) => handle.getFile()))
            .then((files) => {
              addFiles(files)
            })
            .catch((error: Error) => {
              console.error('File picker error:', error)
              setLocalError('Unable to open your file picker.')
            })
        })
        .catch((error: Error) => {
          if (error.name !== 'AbortError') {
            inputRef.current?.click()
          }
        })
    } else {
      inputRef.current?.click()
    }
  }, [addFiles])

  const processSingleItem = async (itemId: string) => {
    const item = useUploadStore.getState().uploadQueue.find((entry) => entry.id === itemId)
    if (!item || !user?.id || !cryptoKey) {
      throw new Error('Missing upload prerequisites')
    }

    const token = await getAccessToken()
    if (!token) {
      throw new Error('Missing access token')
    }

    updateProgress(item.id, {
      status: 'encrypting',
      encryptProgress: 0,
      uploadProgress: 0,
      error: null,
    })

    const result = await uploadFile({
      file: item.file,
      token,
      userId: user.id,
      cryptoKey,
      onEncryptProgress: (pct) => {
        updateProgress(item.id, { status: 'encrypting', encryptProgress: pct })
      },
      onUploadProgress: (pct) => {
        updateProgress(item.id, {
          status: 'uploading',
          uploadProgress: pct,
        })
      },
    })

    const insertResult = await supabaseProxy.insertBackup(token, {
      cid: result.cid,
      iv: result.iv,
      mime_type: result.mimeType,
      encrypted_size: result.encryptedSize,
      original_size: result.originalSize,
      original_filename: result.originalFilename,
      original_hash: result.originalHash,
    })

    updateProgress(item.id, {
      status: 'done',
      encryptProgress: 100,
      uploadProgress: 100,
      error: null,
    })

    return insertResult
  }

  const handleStartBackup = async () => {
    if (!ready || !authenticated) {
      setLocalError('Please sign in before backing up files.')
      return
    }

    if (!isReady || !cryptoKey) {
      setLocalError('Preparing encryption key. Please wait a moment.')
      return
    }

    const pendingItems = uploadQueue.filter((item) => item.status !== 'done')
    if (pendingItems.length === 0) {
      setLocalError('Add at least one photo or video to start backing up.')
      return
    }

    setIsProcessing(true)
    setLocalError(null)

    try {
      for (const item of pendingItems) {
        try {
          await processSingleItem(item.id)
        } catch (error) {
          const message = error instanceof DuplicateFileError ? error.message : getErrorMessage(error)
          updateProgress(item.id, { status: 'error', error: message })

          if (error instanceof DuplicateFileError) {
            toast.info(message)
          } else {
            toast.error(message)
          }
        }
      }

      onComplete?.()
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="border-vault-border bg-vault-surface">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl text-vault-text">Backup your memories</CardTitle>
            <CardDescription className="text-vault-text-muted">
              Select photos or videos, encrypt them locally, then upload the encrypted blobs to decentralized storage.
            </CardDescription>
          </div>
          <EncryptionBadge />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />

        <motion.div
          className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-vault-border-strong bg-vault-bg p-12 transition-colors hover:border-vault-accent/60"
          onClick={handleClick}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            addFiles(Array.from(event.dataTransfer.files))
          }}
          whileHover={{ borderColor: 'rgba(99,102,241,0.4)' }}
          whileTap={{ scale: 0.99 }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-vault-accent/10 text-vault-accent"
          >
            <Upload className="h-7 w-7" />
          </motion.div>

          <div className="space-y-1 text-center">
            <p className="font-medium text-vault-text">Drop photos and videos here</p>
            <p className="text-sm text-vault-text-muted">or click to browse your files</p>
            <p className="text-xs text-vault-text-muted">Encrypted before leaving your device</p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-vault-border px-3 py-1 text-xs text-vault-text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-vault-success" />
            Native drag and drop
          </div>

          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              handleClick()
            }}
            disabled={isUploading || isProcessing}
            className="gap-2 bg-vault-accent text-white hover:bg-vault-accent-hover"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <FolderOpen className="h-4 w-4" />
            Choose Files
          </Button>

          <p className="text-xs text-vault-text-muted">JPG, PNG, HEIC, MP4, MOV and more</p>
        </motion.div>

        {localError ? (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 rounded-xl border border-vault-error/30 bg-vault-error/10 px-4 py-3 text-sm text-vault-error"
          >
            <span>{localError}</span>
            <button type="button" onClick={() => setLocalError(null)} className="text-vault-error/80">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ) : null}

        {encryptionError ? (
          <div className="rounded-xl border border-vault-error/30 bg-vault-error/10 px-4 py-3 text-sm text-vault-error">
            {encryptionError.message}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-vault-text-muted">
            <Badge variant="outline" className="border-vault-border text-vault-text-muted">
              {uploadQueue.length} selected
            </Badge>
            <span>Encryption happens before any network transfer.</span>
          </div>

          <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              uppyRef.current?.cancelAll()
              clearQueue()
            }}
            disabled={uploadQueue.length === 0 || isProcessing}
            className="border-vault-border-strong bg-transparent text-vault-text-muted hover:border-vault-accent hover:text-vault-accent"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
              Clear
            </Button>

            <Button
              type="button"
              className="gap-2 bg-vault-accent text-white hover:bg-vault-accent-hover"
              onClick={() => void handleStartBackup()}
              disabled={!ready || !authenticated || !isReady || !cryptoKey || uploadQueue.length === 0 || isProcessing}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Start Backup
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}