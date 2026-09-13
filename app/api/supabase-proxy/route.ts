// Supabase proxy: the only privileged database path. Verifies the Privy JWT
// (jose + Privy JWKS), resolves users.id from privy_user_id, and scopes every
// operation by that owner with the service-role admin client. Trust boundary:
// this route bypasses RLS by design, so its token check + ownership scoping IS
// the access control; RLS policies are defense-in-depth only.

import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken'
import { getAdminClient } from '@/lib/supabase/admin'
import { isProxyOperation, parseProxyPayload } from '@/lib/validations/proxy'
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

function proxyError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function logProxyFailure(context: string, error: unknown) {
  console.error(`[API] ${context}:`, error)
}

async function resolveUserId(supabase: ReturnType<typeof getAdminClient>, privyUserId: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id')
    .eq('privy_user_id', privyUserId)
    .maybeSingle()

  if (error) {
    logProxyFailure('resolveUserId', error)
    return { user: null, response: proxyError('Something went wrong', 500) }
  }

  if (!user) {
    return { user: null, response: proxyError('User not found', 404) }
  }

  return { user, response: null }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      token?: string
      operation?: string
      payload?: Record<string, unknown>
    } | null

    if (!body?.operation || !isProxyOperation(body.operation)) {
      return proxyError('Invalid request', 400)
    }

    const { token, operation, payload } = body
    console.log(`[API] Operation: ${operation}`)

    if (operation === 'get_share_public') {
      let sharePayload: ReturnType<typeof parseProxyPayload<'get_share_public'>>
      try {
        sharePayload = parseProxyPayload('get_share_public', payload)
      } catch (error) {
        if (error instanceof ZodError) {
          return proxyError('This link is no longer available', 404)
        }
        throw error
      }

      const supabase = getAdminClient()
      const { data: share, error } = await supabase
        .from('shares')
        .select('share_cid, iv, mime_type, original_filename, revoked_at, expires_at, view_count')
        .eq('id', sharePayload.shareId)
        .maybeSingle()

      if (error || !share) {
        return proxyError('This link is no longer available', 404)
      }

      if (share.revoked_at || new Date(share.expires_at) < new Date()) {
        return proxyError('This link is no longer available', 404)
      }

      // Best-effort atomic increment: a failed count must never break the
      // share view itself, so RPC errors are logged and ignored.
      const { error: viewCountError } = await supabase.rpc('increment_share_view_count', {
        p_share_id: sharePayload.shareId,
      })
      if (viewCountError) {
        logProxyFailure('get_share_public view_count', viewCountError)
      }

      return NextResponse.json({
        shareCid: share.share_cid,
        iv: share.iv,
        mimeType: share.mime_type,
        originalFilename: share.original_filename,
      })
    }

    if (!token) {
      return proxyError('Invalid request', 400)
    }

    const privyUserId = await verifyPrivyToken(token)
    const supabase = getAdminClient()

    if (operation === 'upsert_user') {
      const { email } = parseProxyPayload('upsert_user', payload)
      console.log(`[API] upsert_user: privyUserId=${privyUserId}, email=${email ?? null}`)
      const { error } = await supabase.from('users').upsert(
        { privy_user_id: privyUserId, email: email ?? null, updated_at: new Date().toISOString() },
        { onConflict: 'privy_user_id' },
      )
      if (error) {
        logProxyFailure('upsert_user', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ success: true })
    }

    if (operation === 'get_user') {
      parseProxyPayload('get_user', payload)
      console.log(`[API] get_user: privyUserId=${privyUserId}`)
      const { data, error } = await supabase
        .from('users')
        .select('id, privy_user_id, email')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (error) {
        logProxyFailure('get_user', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ data })
    }

    if (operation === 'get_backups') {
      const queryPayload = parseProxyPayload('get_backups', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const offset = queryPayload.offset ?? 0
      const limit = queryPayload.limit ?? 40
      const sortOrder = queryPayload.sortOrder ?? 'newest'
      const mediaFilter = queryPayload.mediaFilter ?? 'all'

      let query = supabase
        .from('backups')
        .select('id, user_id, cid, original_filename, original_hash, mime_type, encrypted_size, original_size, iv, thumbnail_cid, metadata_encrypted, created_at, updated_at')
        .eq('user_id', resolved.user!.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: sortOrder === 'oldest' })
        .range(offset, offset + limit - 1)

      if (mediaFilter === 'photos') {
        query = query.like('mime_type', 'image/%')
      } else if (mediaFilter === 'videos') {
        query = query.like('mime_type', 'video/%')
      }

      const { data, error } = await query
      if (error) {
        logProxyFailure('get_backups', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ data: (data ?? []).map((row) => toBackupRecord(row as BackupRow)) })
    }

    if (operation === 'check_duplicate') {
      const { originalHash } = parseProxyPayload('check_duplicate', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return NextResponse.json({ data: null })

      const { data } = await supabase
        .from('backups')
        .select('id, original_hash')
        .eq('user_id', resolved.user!.id)
        .eq('original_hash', originalHash)
        .maybeSingle()
      return NextResponse.json({ data: data ?? null })
    }

    if (operation === 'get_storage_stats') {
      parseProxyPayload('get_storage_stats', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return NextResponse.json({ data: [] })

      const { data, error } = await supabase
        .from('backups')
        .select('encrypted_size, original_size, mime_type')
        .eq('user_id', resolved.user!.id)
      if (error) {
        logProxyFailure('get_storage_stats', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ data })
    }

    if (operation === 'insert_backup') {
      const backupPayload = parseProxyPayload('insert_backup', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { data, error } = await supabase
        .from('backups')
        .insert({
          user_id: resolved.user!.id,
          cid: backupPayload.cid,
          iv: backupPayload.iv,
          mime_type: backupPayload.mime_type,
          encrypted_size: backupPayload.encrypted_size,
          original_size: backupPayload.original_size,
          original_filename: backupPayload.original_filename,
          original_hash: backupPayload.original_hash,
          thumbnail_cid: backupPayload.thumbnail_cid ?? null,
          metadata_encrypted: backupPayload.metadata_encrypted ?? null,
        })
        .select('*')
        .maybeSingle()
      if (error || !data) {
        logProxyFailure('insert_backup', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ data: toBackupRecord(data as BackupRow) })
    }

    if (operation === 'delete_backup') {
      const { backupId } = parseProxyPayload('delete_backup', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { error } = await supabase
        .from('backups')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', backupId)
        .eq('user_id', resolved.user!.id)
      if (error) {
        logProxyFailure('delete_backup', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ success: true })
    }

    if (operation === 'get_trash') {
      const trashPayload = parseProxyPayload('get_trash', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const offset = trashPayload.offset ?? 0
      const limit = trashPayload.limit ?? 40

      const { data, error } = await supabase
        .from('backups')
        .select('id, user_id, cid, original_filename, original_hash, mime_type, encrypted_size, original_size, iv, thumbnail_cid, metadata_encrypted, created_at, updated_at, deleted_at')
        .eq('user_id', resolved.user!.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .range(offset, offset + limit - 1)
      if (error) {
        logProxyFailure('get_trash', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ data: (data ?? []).map((row) => toBackupRecord(row as BackupRow)) })
    }

    if (operation === 'restore_backup') {
      const { backupId } = parseProxyPayload('restore_backup', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { error } = await supabase
        .from('backups')
        .update({ deleted_at: null })
        .eq('id', backupId)
        .eq('user_id', resolved.user!.id)
      if (error) {
        logProxyFailure('restore_backup', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ success: true })
    }

    if (operation === 'hard_delete_backup') {
      const { backupId } = parseProxyPayload('hard_delete_backup', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { error } = await supabase
        .from('backups')
        .delete()
        .eq('id', backupId)
        .eq('user_id', resolved.user!.id)
      if (error) {
        logProxyFailure('hard_delete_backup', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ success: true })
    }

    if (operation === 'create_album') {
      const { name } = parseProxyPayload('create_album', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { data, error } = await supabase
        .from('albums')
        .insert({ user_id: resolved.user!.id, name })
        .select('*')
        .maybeSingle()
      if (error || !data) {
        logProxyFailure('create_album', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ data })
    }

    if (operation === 'list_albums') {
      parseProxyPayload('list_albums', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('user_id', resolved.user!.id)
        .order('created_at', { ascending: false })
      if (error) {
        logProxyFailure('list_albums', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ data: data ?? [] })
    }

    if (operation === 'add_to_album') {
      const { albumId, backupId } = parseProxyPayload('add_to_album', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { error } = await supabase
        .from('album_backups')
        .insert({ album_id: albumId, backup_id: backupId })
      if (error) {
        logProxyFailure('add_to_album', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ success: true })
    }

    if (operation === 'remove_from_album') {
      const { albumId, backupId } = parseProxyPayload('remove_from_album', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { error } = await supabase
        .from('album_backups')
        .delete()
        .eq('album_id', albumId)
        .eq('backup_id', backupId)
      if (error) {
        logProxyFailure('remove_from_album', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ success: true })
    }

    if (operation === 'get_album_backups') {
      const { albumId } = parseProxyPayload('get_album_backups', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { data: album } = await supabase
        .from('albums')
        .select('id')
        .eq('id', albumId)
        .eq('user_id', resolved.user!.id)
        .maybeSingle()
      if (!album) return proxyError('Album not found', 404)

      const { data, error } = await supabase
        .from('album_backups')
        .select('backup_id')
        .eq('album_id', albumId)
      if (error) {
        logProxyFailure('get_album_backups', error)
        return proxyError('Something went wrong', 500)
      }

      const backupIds = (data ?? []).map((row: { backup_id: string }) => row.backup_id)
      if (backupIds.length === 0) {
        return NextResponse.json({ data: [] })
      }

      const { data: backups, error: backupsError } = await supabase
        .from('backups')
        .select('id, user_id, cid, original_filename, original_hash, mime_type, encrypted_size, original_size, iv, thumbnail_cid, metadata_encrypted, created_at, updated_at, deleted_at')
        .in('id', backupIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (backupsError) {
        logProxyFailure('get_album_backups backups', backupsError)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ data: (backups ?? []).map((row) => toBackupRecord(row as BackupRow)) })
    }

    if (operation === 'get_activity') {
      const activityPayload = parseProxyPayload('get_activity', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const limit = activityPayload.limit ?? 50

      const { data: backups, error: backupsError } = await supabase
        .from('backups')
        .select('id, original_filename, created_at, deleted_at')
        .eq('user_id', resolved.user!.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (backupsError) {
        logProxyFailure('get_activity', backupsError)
        return proxyError('Something went wrong', 500)
      }

      const activities = (backups ?? []).map((row: { id: string; original_filename: string | null; created_at: string; deleted_at: string | null }) => ({
        type: row.deleted_at ? 'deleted' : 'uploaded',
        filename: row.original_filename ?? 'Untitled',
        timestamp: row.deleted_at || row.created_at,
        backupId: row.id,
      }))

      return NextResponse.json({ data: activities })
    }

    if (operation === 'create_share') {
      const sharePayload = parseProxyPayload('create_share', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { data: backup } = await supabase
        .from('backups')
        .select('id')
        .eq('id', sharePayload.backupId)
        .eq('user_id', resolved.user!.id)
        .maybeSingle()
      if (!backup) return proxyError('Backup not found', 404)

      const expiresInHours = sharePayload.expiresInHours ?? 24
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('shares')
        .insert({
          backup_id: sharePayload.backupId,
          owner_user_id: resolved.user!.id,
          share_cid: sharePayload.shareCid,
          iv: sharePayload.iv,
          mime_type: sharePayload.mimeType ?? null,
          original_filename: sharePayload.originalFilename ?? null,
          expires_at: expiresAt,
        })
        .select('id')
        .maybeSingle()
      if (error || !data) {
        logProxyFailure('create_share', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ data })
    }

    if (operation === 'list_shares') {
      parseProxyPayload('list_shares', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { data, error } = await supabase
        .from('shares')
        .select('id, backup_id, original_filename, expires_at, revoked_at, view_count, created_at')
        .eq('owner_user_id', resolved.user!.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (error) {
        logProxyFailure('list_shares', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ data: data ?? [] })
    }

    if (operation === 'revoke_share') {
      const { shareId } = parseProxyPayload('revoke_share', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { error } = await supabase
        .from('shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', shareId)
        .eq('owner_user_id', resolved.user!.id)
      if (error) {
        logProxyFailure('revoke_share', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ success: true })
    }

    if (operation === 'get_encryption_key') {
      parseProxyPayload('get_encryption_key', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return NextResponse.json({ data: null })

      const { data } = await supabase
        .from('encryption_keys')
        .select('encrypted_key_blob, key_salt, key_version')
        .eq('user_id', resolved.user!.id)
        .maybeSingle()
      return NextResponse.json({ data: data ?? null })
    }

    if (operation === 'save_encryption_key') {
      const keyPayload = parseProxyPayload('save_encryption_key', payload)
      const resolved = await resolveUserId(supabase, privyUserId)
      if (resolved.response) return resolved.response

      const { error } = await supabase
        .from('encryption_keys')
        .upsert(
          {
            user_id: resolved.user!.id,
            encrypted_key_blob: keyPayload.encryptedKeyBlob,
            key_salt: keyPayload.keySalt,
            key_version: keyPayload.keyVersion ?? 1,
          },
          { onConflict: 'user_id' },
        )
      if (error) {
        logProxyFailure('save_encryption_key', error)
        return proxyError('Something went wrong', 500)
      }
      return NextResponse.json({ success: true })
    }

    return proxyError('Invalid request', 400)
  } catch (error) {
    if (error instanceof ZodError) {
      return proxyError('Invalid request', 400)
    }

    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Supabase proxy error:', error)

    if (message.includes('fetch') || message.includes('network') || message.includes('ECONNREFUSED')) {
      return proxyError('Service unavailable', 503)
    }
    if (message.includes('JWT') || message.includes('token') || message.includes('unauthorized')) {
      return proxyError('Unauthorized', 401)
    }

    return proxyError('Something went wrong', 500)
  }
}
