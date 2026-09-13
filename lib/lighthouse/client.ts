import { storageProvider } from './provider'

export async function uploadToLighthouse(
  encryptedBlob: Blob,
  filename: string,
  accessToken: string
): Promise<string> {
  if (storageProvider === 'mock') {
    const { uploadToMockStorage } = await import('./mockClient')
    return uploadToMockStorage(encryptedBlob, filename, accessToken)
  }

  const formData = new FormData()
  formData.append('file', encryptedBlob, filename)
  formData.append('token', accessToken)

  const response = await fetch('/api/lighthouse-upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(typeof err.error === 'string' ? err.error : 'Upload failed')
  }

  const body = (await response.json()) as { cid?: string }
  if (!body.cid) {
    throw new Error('Upload failed')
  }

  return body.cid
}

export function getGatewayUrl(cid: string): string {
  return `https://gateway.lighthouse.storage/ipfs/${cid}`
}
