const validMockCid = /^mock-[0-9a-f-]{36}$/i

async function getNodeStorage() {
  if (typeof process === 'undefined' || !process.versions?.node) {
    throw new Error('Mock storage is only available in Node-based verification runs')
  }

  const storageDirectory = `${process.cwd()}/.test-storage`
  const { mkdir, readFile, writeFile } = await import(
    /* webpackIgnore: true */
    /* @vite-ignore */
    'node:fs/promises'
  )

  return { mkdir, readFile, writeFile, storageDirectory }
}

function makeCid(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (!uuid) {
    throw new Error('Web Crypto randomUUID is unavailable for mock storage')
  }
  return `mock-${uuid}`
}

function pathForCid(storageDirectory: string, cid: string): string {
  if (!validMockCid.test(cid)) {
    throw new Error('Invalid mock storage CID')
  }
  return `${storageDirectory}/${cid}.bin`
}

export async function uploadToMockStorage(encryptedBlob: Blob, _filename: string, _accessToken: string): Promise<string> {
  const cid = makeCid()
  const { mkdir, writeFile, storageDirectory } = await getNodeStorage()
  await mkdir(storageDirectory, { recursive: true })
  await writeFile(pathForCid(storageDirectory, cid), new Uint8Array(await encryptedBlob.arrayBuffer()))
  return cid
}

export async function fetchMockEncryptedBlob(cid: string): Promise<Blob> {
  const { readFile, storageDirectory } = await getNodeStorage()

  try {
    const bytes = await readFile(pathForCid(storageDirectory, cid))
    return new Blob([bytes], { type: 'application/octet-stream' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`Mock storage object not found: ${cid} (${message})`)
  }
}
