import { storageProvider } from './provider'

export async function fetchEncryptedBlob(cid: string): Promise<Blob> {
  if (storageProvider === 'mock') {
    const { fetchMockEncryptedBlob } = await import('./mockClient')
    return fetchMockEncryptedBlob(cid)
  }

  // Try multiple gateways in order — Lighthouse first, then public fallbacks
  const gateways = [
    `https://gateway.lighthouse.storage/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`,
  ]

  const errors: string[] = []

  for (const url of gateways) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return response.blob()
      }
      errors.push(`${url}: ${response.status}`)
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : 'fetch failed'}`)
    }
  }

  throw new Error(`All gateways failed:\n${errors.join('\n')}`)
}

export async function fetchWithRetry(cid: string): Promise<Blob> {
  // fetchEncryptedBlob already tries multiple gateways — no extra retry needed
  return fetchEncryptedBlob(cid)
}
