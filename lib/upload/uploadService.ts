'use client'

import { uploadToLighthouse } from '@/lib/lighthouse/client'
import { supabaseProxy } from '@/lib/api/supabaseProxy'

export type UploadFileParams = {
  file: File
  token: string
  userId: string
  cryptoKey: CryptoKey
  onEncryptProgress: (pct: number) => void
  onUploadProgress: (pct: number) => void
}

export type UploadResult = {
  cid: string
  iv: string
  mimeType: string
  encryptedSize: number
  originalSize: number
  originalFilename: string
  originalHash: string
}

export class DuplicateFileError extends Error {
  constructor() {
    super('This file is already in your vault')
    this.name = 'DuplicateFileError'
  }
}

export async function uploadFile({
  file,
  token,
  userId,
  cryptoKey,
  onEncryptProgress,
  onUploadProgress,
}: UploadFileParams): Promise<UploadResult> {
  // Step 1: Import encryption functions
  const { encryptFile, stripExif } = await import('@/lib/encryption')

  // Step 2: Strip EXIF
  const strippedFile = await stripExif(file)

  // Step 3: Compute hash of original for dedup
  const arrayBuffer = await strippedFile.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const originalHash = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')

  // Step 4: Check for duplicate via proxy
  const dupResult = await supabaseProxy.checkDuplicate(token, originalHash)
  if (dupResult.data) {
    throw new DuplicateFileError()
  }

  // Step 5: Encrypt the file
  const { encryptedBlob, iv } = await encryptFile(strippedFile, cryptoKey, onEncryptProgress)

  // Step 6: Upload encrypted blob to Lighthouse
  onUploadProgress(0)
  const cid = await uploadToLighthouse(encryptedBlob, file.name, token)
  onUploadProgress(100)

  return {
    cid,
    iv,
    mimeType: file.type,
    encryptedSize: encryptedBlob.size,
    originalSize: file.size,
    originalFilename: file.name,
    originalHash,
  }
}

export async function uploadMultipleFiles(
  files: File[],
  params: Omit<UploadFileParams, 'file'>,
): Promise<{ success: UploadResult[]; failed: { file: File; error: Error }[] }> {
  const success: UploadResult[] = []
  const failed: { file: File; error: Error }[] = []

  for (const file of files) {
    try {
      const result = await uploadFile({ file, ...params })
      success.push(result)
    } catch (error) {
      failed.push({ file, error: error instanceof Error ? error : new Error('Upload failed') })
    }
  }

  return { success, failed }
}
