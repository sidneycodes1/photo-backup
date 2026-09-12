'use client'
import { useEffect, useRef, useState } from 'react'
import { useEncryption } from '@/hooks/useEncryption'
import { fetchWithRetry } from '@/lib/lighthouse/retrieve'
import { decryptFile } from '@/lib/encryption'
import type { BackupRecord } from '@/types'

export function useThumbnail(backup: BackupRecord) {
  const { cryptoKey, isReady } = useEncryption()
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    // If no thumbnail CID, try to use the main CID with the same IV
    const cidToFetch = backup.thumbnailCid ?? backup.cid
    const ivToUse = backup.iv

    if (!cidToFetch || !ivToUse || !isReady || !cryptoKey) return

    let cancelled = false
    setIsLoading(true)
    setError(null)

    async function loadThumbnail() {
      try {
        // Fetch encrypted blob from Lighthouse
        const encryptedBlob = await fetchWithRetry(cidToFetch)

        if (cancelled) return

        // Decrypt it
        const mimeType = backup.mimeType ?? 'image/jpeg'
        const decryptedBlob = await decryptFile(
          encryptedBlob,
          cryptoKey!,
          ivToUse,
          mimeType
        )

        if (cancelled) return

        // For large files/videos, create a smaller preview
        let previewBlob = decryptedBlob
        if (mimeType.startsWith('image/') && decryptedBlob.size > 500_000) {
          // Resize image to thumbnail
          previewBlob = await resizeImageToThumbnail(decryptedBlob, mimeType)
        }

        if (cancelled) return

        // Revoke previous URL
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
        }

        const url = URL.createObjectURL(previewBlob)
        objectUrlRef.current = url

        if (mountedRef.current) {
          setThumbnailUrl(url)
          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          setError(err instanceof Error ? err : new Error('Failed to load thumbnail'))
          setIsLoading(false)
        }
      }
    }

    loadThumbnail()
    return () => { cancelled = true }
  }, [backup.cid, backup.thumbnailCid, backup.iv, backup.mimeType, isReady, cryptoKey])

  return { thumbnailUrl, isLoading, error }
}

async function resizeImageToThumbnail(blob: Blob, mimeType: string): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    
    img.onload = () => {
      URL.revokeObjectURL(url)
      
      const maxSize = 400
      const ratio = Math.min(maxSize / img.width, maxSize / img.height)
      const width = Math.round(img.width * ratio)
      const height = Math.round(img.height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(blob); return }
      
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (result) => resolve(result ?? blob),
        'image/jpeg',
        0.8
      )
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(blob)
    }
    
    img.src = url
  })
}
