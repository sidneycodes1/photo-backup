// This route uses the admin client and bypasses RLS.
// Authorization is enforced here via privy_user_id lookups on every operation.
// RLS policies on the underlying tables are defense-in-depth only and are not the primary access control.

import { NextRequest, NextResponse } from 'next/server'
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken'
import { getAdminClient } from '@/lib/supabase/admin'
import type { BackupRecord } from '@/types'

type BackupRow = {
  id: string
  user_id: string
  cid: string
  original_filename: string | null
  original_hash: string | null
  mime_type: string | null
  encrypted_size: number | null
  original_size: number | null
  iv: string
  thumbnail_cid: string | null
  metadata_encrypted: Record<string, unknown> | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function toBackupRecord(row: BackupRow): BackupRecord {
  return {
    id: row.id,
    userId: row.user_id,
    cid: row.cid,
    originalFilename: row.original_filename,
    originalHash: row.original_hash,
    mimeType: row.mime_type,
    encryptedSize: row.encrypted_size,
    originalSize: row.original_size,
    iv: row.iv,
    thumbnailCid: row.thumbnail_cid,
    metadataEncrypted: row.metadata_encrypted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      token?: string
      operation?: string
      payload?: Record<string, unknown>
    } | null

    if (!body?.operation) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { token, operation, payload } = body
    console.log(`[API] Operation: ${operation}`)
    
    // get_share_public is the only operation that doesn't require authentication
    if (operation === 'get_share_public') {
      const shareId = typeof payload?.shareId === 'string' ? payload.shareId.trim() : ''
      if (!shareId) {
        return NextResponse.json({ error: 'This link is no longer available' }, { status: 404 })
      }

      const supabase = getAdminClient()
      const { data: share, error } = await supabase
        .from('shares')
        .select('share_cid, iv, mime_type, original_filename, revoked_at, expires_at, view_count')
        .eq('id', shareId)
        .maybeSingle()

      if (error || !share) {
        return NextResponse.json({ error: 'This link is no longer available' }, { status: 404 })
      }

      // Check if share is revoked or expired
      if (share.revoked_at || new Date(share.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This link is no longer available' }, { status: 404 })
      }

      // Increment view count
      await supabase
        .from('shares')
        .update({ view_count: (share as any).view_count + 1 })
        .eq('id', shareId)

      return NextResponse.json({
        shareCid: share.share_cid,
        iv: share.iv,
        mimeType: share.mime_type,
        originalFilename: share.original_filename,
      })
    }

    if (!body?.token) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const privyUserId = await verifyPrivyToken(body.token)
    const supabase = getAdminClient()

    if (operation === 'upsert_user') {
      const email = typeof payload?.email === 'string' ? payload.email : null
      console.log(`[API] upsert_user: privyUserId=${privyUserId}, email=${email}`)
      const { error } = await supabase.from('users').upsert(
        { privy_user_id: privyUserId, email, updated_at: new Date().toISOString() },
        { onConflict: 'privy_user_id' }
      )
      if (error) {
        console.error(`[API] upsert_user error:`, error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    if (operation === 'get_user') {
      console.log(`[API] get_user: privyUserId=${privyUserId}`)
      const { data, error } = await supabase
        .from('users')
        .select('id, privy_user_id, email')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (error) {
        console.error(`[API] get_user error:`, error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ data })
    }

    if (operation === 'get_backups') {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const offset = typeof payload?.offset === 'number' ? payload.offset : 0
      const limit = typeof payload?.limit === 'number' ? payload.limit : 40
      const sortOrder = payload?.sortOrder === 'oldest' ? 'oldest' : 'newest'
      const mediaFilter =
        payload?.mediaFilter === 'photos' || payload?.mediaFilter === 'videos'
          ? (payload.mediaFilter as 'photos' | 'videos')
          : 'all'

      let query = supabase
        .from('backups')
        .select('id, user_id, cid, original_filename, original_hash, mime_type, encrypted_size, original_size, iv, thumbnail_cid, metadata_encrypted, created_at, updated_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: sortOrder === 'oldest' })
        .range(offset, offset + limit - 1)

      if (mediaFilter === 'photos') {
        query = query.like('mime_type', 'image/%')
      } else if (mediaFilter === 'videos') {
        query = query.like('mime_type', 'video/%')
      }

      const { data, error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: (data ?? []).map((row) => toBackupRecord(row as BackupRow)) })
    }

    if (operation === 'check_duplicate') {
      const originalHash = typeof payload?.originalHash === 'string'
        ? payload.originalHash
        : ''
      if (!originalHash) return NextResponse.json({ data: null })

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ data: null })

      const { data } = await supabase
        .from('backups')
        .select('id, original_hash')
        .eq('user_id', user.id)
        .eq('original_hash', originalHash)
        .maybeSingle()
      return NextResponse.json({ data: data ?? null })
    }

    if (operation === 'get_storage_stats') {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ data: [] })

      const { data, error } = await supabase
        .from('backups')
        .select('encrypted_size, original_size, mime_type')
        .eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (operation === 'insert_backup') {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { data, error } = await supabase
        .from('backups')
        .insert({ ...payload, user_id: user.id })
        .select('*')
        .maybeSingle()
      if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to save backup' }, { status: 500 })
      return NextResponse.json({ data: toBackupRecord(data as BackupRow) })
    }

    if (operation === 'delete_backup') {
      const backupId = typeof payload?.backupId === 'string' ? payload.backupId.trim() : ''
      if (!backupId) {
        return NextResponse.json({ error: 'Missing backupId' }, { status: 400 })
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { error } = await supabase
        .from('backups')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', backupId)
        .eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (operation === 'get_trash') {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const offset = typeof payload?.offset === 'number' ? payload.offset : 0
      const limit = typeof payload?.limit === 'number' ? payload.limit : 40

      const { data, error } = await supabase
        .from('backups')
        .select('id, user_id, cid, original_filename, original_hash, mime_type, encrypted_size, original_size, iv, thumbnail_cid, metadata_encrypted, created_at, updated_at, deleted_at')
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .range(offset, offset + limit - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: (data ?? []).map((row) => toBackupRecord(row as BackupRow)) })
    }

    if (operation === 'restore_backup') {
      const backupId = typeof payload?.backupId === 'string' ? payload.backupId.trim() : ''
      if (!backupId) {
        return NextResponse.json({ error: 'Missing backupId' }, { status: 400 })
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { error } = await supabase
        .from('backups')
        .update({ deleted_at: null })
        .eq('id', backupId)
        .eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (operation === 'hard_delete_backup') {
      const backupId = typeof payload?.backupId === 'string' ? payload.backupId.trim() : ''
      if (!backupId) {
        return NextResponse.json({ error: 'Missing backupId' }, { status: 400 })
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { error } = await supabase
        .from('backups')
        .delete()
        .eq('id', backupId)
        .eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (operation === 'create_album') {
      const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
      if (!name) {
        return NextResponse.json({ error: 'Missing album name' }, { status: 400 })
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { data, error } = await supabase
        .from('albums')
        .insert({ user_id: user.id, name })
        .select('*')
        .maybeSingle()
      if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create album' }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (operation === 'list_albums') {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: data ?? [] })
    }

    if (operation === 'add_to_album') {
      const albumId = typeof payload?.albumId === 'string' ? payload.albumId.trim() : ''
      const backupId = typeof payload?.backupId === 'string' ? payload.backupId.trim() : ''
      if (!albumId || !backupId) {
        return NextResponse.json({ error: 'Missing albumId or backupId' }, { status: 400 })
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { error } = await supabase
        .from('album_backups')
        .insert({ album_id: albumId, backup_id: backupId })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (operation === 'remove_from_album') {
      const albumId = typeof payload?.albumId === 'string' ? payload.albumId.trim() : ''
      const backupId = typeof payload?.backupId === 'string' ? payload.backupId.trim() : ''
      if (!albumId || !backupId) {
        return NextResponse.json({ error: 'Missing albumId or backupId' }, { status: 400 })
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { error } = await supabase
        .from('album_backups')
        .delete()
        .eq('album_id', albumId)
        .eq('backup_id', backupId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (operation === 'get_album_backups') {
      const albumId = typeof payload?.albumId === 'string' ? payload.albumId.trim() : ''
      if (!albumId) {
        return NextResponse.json({ error: 'Missing albumId' }, { status: 400 })
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { data: album } = await supabase
        .from('albums')
        .select('id')
        .eq('id', albumId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 })

      const { data, error } = await supabase
        .from('album_backups')
        .select('backup_id')
        .eq('album_id', albumId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const backupIds = (data ?? []).map((row: any) => row.backup_id)

      if (backupIds.length === 0) {
        return NextResponse.json({ data: [] })
      }

      const { data: backups, error: backupsError } = await supabase
        .from('backups')
        .select('id, user_id, cid, original_filename, original_hash, mime_type, encrypted_size, original_size, iv, thumbnail_cid, metadata_encrypted, created_at, updated_at, deleted_at')
        .in('id', backupIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (backupsError) return NextResponse.json({ error: backupsError.message }, { status: 500 })
      return NextResponse.json({ data: (backups ?? []).map((row) => toBackupRecord(row as BackupRow)) })
    }

    if (operation === 'get_activity') {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const limit = typeof payload?.limit === 'number' ? payload.limit : 50

      const { data: backups, error: backupsError } = await supabase
        .from('backups')
        .select('id, original_filename, created_at, deleted_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (backupsError) return NextResponse.json({ error: backupsError.message }, { status: 500 })

      const activities = (backups ?? []).map((row: any) => ({
        type: row.deleted_at ? 'deleted' : 'uploaded',
        filename: row.original_filename ?? 'Untitled',
        timestamp: row.deleted_at || row.created_at,
        backupId: row.id,
      }))

      return NextResponse.json({ data: activities })
    }

    if (operation === 'create_share') {
      const backupId = typeof payload?.backupId === 'string' ? payload.backupId.trim() : ''
      const shareCid = typeof payload?.shareCid === 'string' ? payload.shareCid.trim() : ''
      const iv = typeof payload?.iv === 'string' ? payload.iv.trim() : ''
      const mimeType = typeof payload?.mimeType === 'string' ? payload.mimeType : null
      const originalFilename = typeof payload?.originalFilename === 'string' ? payload.originalFilename : null
      const expiresInHours = typeof payload?.expiresInHours === 'number' ? payload.expiresInHours : 24

      if (!backupId || !shareCid || !iv) {
        return NextResponse.json({ error: 'Missing backupId, shareCid, or iv' }, { status: 400 })
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { data: backup } = await supabase
        .from('backups')
        .select('id')
        .eq('id', backupId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!backup) return NextResponse.json({ error: 'Backup not found' }, { status: 404 })

      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('shares')
        .insert({
          backup_id: backupId,
          owner_user_id: user.id,
          share_cid: shareCid,
          iv: iv,
          mime_type: mimeType,
          original_filename: originalFilename,
          expires_at: expiresAt,
        })
        .select('id')
        .maybeSingle()
      if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create share' }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (operation === 'list_shares') {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { data, error } = await supabase
        .from('shares')
        .select('id, backup_id, original_filename, expires_at, revoked_at, view_count, created_at')
        .eq('owner_user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: data ?? [] })
    }

    if (operation === 'revoke_share') {
      const shareId = typeof payload?.shareId === 'string' ? payload.shareId.trim() : ''
      if (!shareId) {
        return NextResponse.json({ error: 'Missing shareId' }, { status: 400 })
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { error } = await supabase
        .from('shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', shareId)
        .eq('owner_user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (operation === 'get_encryption_key') {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ data: null })

      const { data } = await supabase
        .from('encryption_keys')
        .select('encrypted_key_blob, key_version')
        .eq('user_id', user.id)
        .maybeSingle()
      return NextResponse.json({ data: data ?? null })
    }

    if (operation === 'save_encryption_key') {
      const encryptedKeyBlob = typeof payload?.encryptedKeyBlob === 'string' ? payload.encryptedKeyBlob : ''
      const keyVersion = typeof payload?.keyVersion === 'number' ? payload.keyVersion : 1

      if (!encryptedKeyBlob) {
        return NextResponse.json({ error: 'Missing encryptedKeyBlob' }, { status: 400 })
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const { error } = await supabase
        .from('encryption_keys')
        .upsert(
          { user_id: user.id, encrypted_key_blob: encryptedKeyBlob, key_version: keyVersion },
          { onConflict: 'user_id' }
        )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (operation === 'get_lighthouse_key') {
      const apiKey = process.env.LIGHTHOUSE_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'Lighthouse not configured' }, { status: 500 })
      }
      return NextResponse.json({ apiKey })
    }

    return NextResponse.json({ error: 'Unknown operation' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Supabase proxy error:', error)
    
    // Return appropriate status codes based on error type
    if (message.includes('fetch') || message.includes('network') || message.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }
    if (message.includes('JWT') || message.includes('token') || message.includes('unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
