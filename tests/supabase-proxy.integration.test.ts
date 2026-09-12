import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const auth = vi.hoisted(() => ({ userId: '' }))

vi.mock('@/lib/auth/verifyPrivyToken', () => ({
  verifyPrivyToken: vi.fn(async (token: string) => {
    if (token !== 'vaultly-test-token') throw new Error('Invalid test token')
    return auth.userId
  }),
}))

import { POST } from '@/app/api/supabase-proxy/route'

const token = 'vaultly-test-token'
const privyUserId = `did:privy:terminal-test:${randomUUID()}`
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Proxy integration tests require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
}

const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function callProxy(operation: string, payload?: Record<string, unknown>, includeToken = true) {
  const response = await POST(
    new Request('http://vaultly.test/api/supabase-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(includeToken ? { token } : {}),
        operation,
        payload,
      }),
    }) as never,
  )
  return { response, body: await response.json() as Record<string, any> }
}

function backupPayload(suffix: string) {
  return {
    cid: `mock-proxy-${suffix}`,
    iv: 'dGVzdC1pdi0xMjM0NTY3',
    mime_type: 'application/octet-stream',
    encrypted_size: 32,
    original_size: 16,
    original_filename: `${suffix}.bin`,
    original_hash: `hash-${suffix}`,
  }
}

beforeAll(() => {
  auth.userId = privyUserId
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterAll(async () => {
  vi.restoreAllMocks()
  // The user is uniquely generated for this process. Database cascades remove
  // its backups, albums, memberships, keys, and shares even after a failed test.
  await admin.from('users').delete().eq('privy_user_id', privyUserId)
})

describe('supabase proxy integration', () => {
  test('exercises user, key, backup, trash, album, share, and public-share operations', async () => {
    let result = await callProxy('upsert_user', { email: 'terminal-test@vaultly.invalid' })
    expect(result.response.status).toBe(200)
    expect(result.body.success).toBe(true)

    result = await callProxy('get_user')
    expect(result.response.status).toBe(200)
    expect(result.body.data.privy_user_id).toBe(privyUserId)

    result = await callProxy('save_encryption_key', { encryptedKeyBlob: 'test-encrypted-key', keyVersion: 7 })
    expect(result.body.success).toBe(true)
    result = await callProxy('get_encryption_key')
    expect(result.body.data).toMatchObject({ encrypted_key_blob: 'test-encrypted-key', key_version: 7 })

    result = await callProxy('get_lighthouse_key')
    expect(result.response.status).toBe(200)
    expect(typeof result.body.apiKey).toBe('string')

    result = await callProxy('check_duplicate', { originalHash: 'hash-primary' })
    expect(result.body.data).toBeNull()

    result = await callProxy('insert_backup', backupPayload('primary'))
    expect(result.response.status).toBe(200)
    const backupId = result.body.data.id as string
    expect(result.body.data.originalHash).toBe('hash-primary')

    result = await callProxy('check_duplicate', { originalHash: 'hash-primary' })
    expect(result.body.data.id).toBe(backupId)

    result = await callProxy('get_backups', { offset: 0, limit: 40 })
    expect(result.body.data.map((backup: { id: string }) => backup.id)).toContain(backupId)
    result = await callProxy('get_storage_stats')
    expect(result.body.data).toHaveLength(1)
    result = await callProxy('get_activity')
    expect(result.body.data[0]).toMatchObject({ backupId, type: 'uploaded' })

    result = await callProxy('create_album', { name: 'Terminal album' })
    const albumId = result.body.data.id as string
    result = await callProxy('list_albums')
    expect(result.body.data.map((album: { id: string }) => album.id)).toContain(albumId)
    result = await callProxy('add_to_album', { albumId, backupId })
    expect(result.body.success).toBe(true)
    result = await callProxy('get_album_backups', { albumId })
    expect(result.body.data.map((backup: { id: string }) => backup.id)).toContain(backupId)
    result = await callProxy('remove_from_album', { albumId, backupId })
    expect(result.body.success).toBe(true)
    result = await callProxy('get_album_backups', { albumId })
    expect(result.body.data).toEqual([])

    result = await callProxy('delete_backup', { backupId })
    expect(result.body.success).toBe(true)
    result = await callProxy('get_trash')
    expect(result.body.data.map((backup: { id: string }) => backup.id)).toContain(backupId)
    result = await callProxy('restore_backup', { backupId })
    expect(result.body.success).toBe(true)

    result = await callProxy('create_share', {
      backupId,
      shareCid: 'mock-share-active',
      iv: 'dGVzdC1zaGFyZS1pdi0x',
      mimeType: 'application/octet-stream',
      originalFilename: 'primary.bin',
      expiresInHours: 1,
    })
    const activeShareId = result.body.data.id as string
    result = await callProxy('list_shares')
    expect(result.body.data.map((share: { id: string }) => share.id)).toContain(activeShareId)
    result = await callProxy('get_share_public', { shareId: activeShareId }, false)
    expect(result.response.status).toBe(200)
    expect(result.body).toMatchObject({ shareCid: 'mock-share-active', originalFilename: 'primary.bin' })

    result = await callProxy('revoke_share', { shareId: activeShareId })
    expect(result.body.success).toBe(true)
    result = await callProxy('get_share_public', { shareId: activeShareId }, false)
    expect(result.response.status).toBe(404)
    expect(result.body.error).toBe('This link is no longer available')

    result = await callProxy('create_share', {
      backupId,
      shareCid: 'mock-share-expired',
      iv: 'dGVzdC1zaGFyZS1pdi0y',
      mimeType: 'application/octet-stream',
      originalFilename: 'primary.bin',
      expiresInHours: -1,
    })
    const expiredShareId = result.body.data.id as string
    result = await callProxy('get_share_public', { shareId: expiredShareId }, false)
    expect(result.response.status).toBe(404)
    expect(result.body.error).toBe('This link is no longer available')

    result = await callProxy('insert_backup', backupPayload('hard-delete'))
    const hardDeleteBackupId = result.body.data.id as string
    result = await callProxy('hard_delete_backup', { backupId: hardDeleteBackupId })
    expect(result.body.success).toBe(true)
  })
})
