'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, AlertTriangle, Lock } from 'lucide-react'
import { decryptFile } from '@/lib/encryption'
import { fetchWithRetry } from '@/lib/lighthouse/retrieve'
import { supabaseProxy } from '@/lib/api/supabaseProxy'
import { base64ToBytes } from '@/lib/encryption/helpers'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ShareData {
  shareCid: string
  iv: string
  mimeType: string | null
  originalFilename: string | null
}

interface SharePageProps {
  params: Promise<{ id: string }>
}

export default function SharePage({ params }: SharePageProps) {
  const [shareId, setShareId] = useState<string | null>(null)
  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decryptedBlob, setDecryptedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDecrypting, setIsDecrypting] = useState(false)

  // One object URL per decrypted blob, revoked on blob change/unmount.
  // (Creating it inline in render leaked a URL on every re-render.)
  useEffect(() => {
    if (!decryptedBlob) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(decryptedBlob)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
      setPreviewUrl(null)
    }
  }, [decryptedBlob])

  useEffect(() => {
    async function loadParams() {
      const resolved = await params
      setShareId(resolved.id)
    }
    loadParams()
  }, [params])

  useEffect(() => {
    if (!shareId) return

    const validShareId = shareId

    async function loadShare() {
      try {
        setIsLoading(true)
        const hash = window.location.hash
        const keyMatch = hash.match(/key=([^&]+)/)
        if (!keyMatch) {
          throw new Error('Invalid share link')
        }
        const base64Key = keyMatch[1]
        const base64 = base64Key.replace(/-/g, '+').replace(/_/g, '/')
        const keyBytes = base64ToBytes(base64)
        const crypto = window.crypto
        const shareKey = await crypto.subtle.importKey(
          'raw',
          keyBytes.buffer as ArrayBuffer,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt'],
        )
        const data = await supabaseProxy.getSharePublic(validShareId)
        setShareData(data)
        const encryptedBlob = await fetchWithRetry(data.shareCid)
        setIsDecrypting(true)
        const decrypted = await decryptFile(encryptedBlob, shareKey, data.iv, data.mimeType ?? 'application/octet-stream')
        setDecryptedBlob(decrypted)
        setIsDecrypting(false)
      } catch (err) {
        console.error('Failed to load share:', err)
        setError('This link is no longer available')
      } finally {
        setIsLoading(false)
      }
    }
    loadShare()
  }, [shareId])

  const handleDownload = () => {
    if (!decryptedBlob || !shareData) return
    const objectUrl = URL.createObjectURL(decryptedBlob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = shareData.originalFilename ?? 'vaultly-shared-file'
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => { URL.revokeObjectURL(objectUrl) }, 1000)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex flex-col items-center gap-4"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-vault-accent/10">
            <Lock className="h-5 w-5 text-vault-accent" />
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Decrypting your shared file...</span>
          </div>
        </motion.div>
      </div>
    )
  }

  if (error || !shareData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Card className="w-full max-w-md border-vault-border bg-vault-surface">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 15, stiffness: 200 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
              >
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
                <div>
                  <h2 className="text-lg font-medium text-vault-text">Link Unavailable</h2>
                  <p className="mt-2 text-sm text-vault-text-muted">
                    This share link has expired, been revoked, or does not exist.
                  </p>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  const isImage = shareData.mimeType?.startsWith('image/')
  const isVideo = shareData.mimeType?.startsWith('video/')

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Card className="border-vault-border bg-vault-surface">
          <CardContent className="p-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-vault-accent/10">
                  <Lock className="h-5 w-5 text-vault-accent" />
                </div>
                <div>
                  <h1 className="text-lg font-medium text-vault-text">{shareData.originalFilename ?? 'Shared File'}</h1>
                  <p className="text-sm text-vault-text-muted">Securely shared via Vaultly</p>
                </div>
              </div>
              <motion.button
                onClick={handleDownload}
                disabled={!decryptedBlob || isDecrypting}
                className="bg-vault-accent text-vault-bg hover:bg-vault-accent/90"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <Download className="mr-2 h-4 w-4" />Download
              </motion.button>
            </motion.div>
            {isDecrypting ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex aspect-video items-center justify-center rounded-lg bg-vault-bg"
              >
                <div className="flex items-center gap-3 text-sm text-vault-text-muted">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-vault-accent border-t-transparent" />
                  <span>Decrypting...</span>
                </div>
              </motion.div>
            ) : decryptedBlob ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="rounded-lg bg-vault-bg"
              >
                {isImage ? (
                  <img src={previewUrl ?? undefined} alt={shareData.originalFilename ?? 'Shared image'} className="h-auto w-full rounded-lg" />
                ) : isVideo ? (
                  <video src={previewUrl ?? undefined} controls className="h-auto w-full rounded-lg" />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg">
                    <div className="text-center"><p className="text-vault-text">File ready for download</p><p className="text-sm text-vault-text-muted mt-1">{shareData.mimeType ?? 'Unknown type'}</p></div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-vault-bg">
                <div className="text-center">
                  <p className="text-vault-text">Unable to preview</p>
                  <p className="text-sm text-vault-text-muted mt-1">Please download to view this file</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
