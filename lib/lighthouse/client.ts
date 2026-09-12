import { supabaseProxy } from '@/lib/api/supabaseProxy'
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

  const result = await supabaseProxy.getLighthouseKey(accessToken)
  const apiKey = result.apiKey as string | undefined
  if (!apiKey) {
    throw new Error('Lighthouse API key not available')
  }

  const arrayBuffer = await encryptedBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const lighthouse = (await import('@lighthouse-web3/sdk')).default
  const response = await lighthouse.uploadBuffer(buffer, apiKey)

  const cid = response?.data?.Hash
  if (!cid) {
    throw new Error('Upload failed - no CID returned from Lighthouse')
  }

  return cid
}

export function getGatewayUrl(cid: string): string {
  return `https://gateway.lighthouse.storage/ipfs/${cid}`
}
