async function callProxy(token: string, operation: string, payload?: Record<string, unknown>) {
  try {
    const response = await fetch('/api/supabase-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, operation, payload }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      console.error(`Proxy error for operation ${operation}:`, err)
      throw new Error(err.error ?? 'Proxy request failed')
    }
    return response.json()
  } catch (error) {
    console.error(`Fetch error for operation ${operation}:`, error)
    throw error
  }
}

export const supabaseProxy = {
  checkDuplicate: (token: string, originalHash: string) =>
    callProxy(token, 'check_duplicate', { originalHash }),

  upsertUser: (token: string, email: string | null) =>
    callProxy(token, 'upsert_user', { email }),

  getUser: (token: string) =>
    callProxy(token, 'get_user'),

  getBackups: (token: string, offset = 0, limit = 40, options?: Record<string, unknown>) =>
    callProxy(token, 'get_backups', { offset, limit, ...options }),

  getStorageStats: (token: string) =>
    callProxy(token, 'get_storage_stats'),

  insertBackup: (token: string, backup: Record<string, unknown>) =>
    callProxy(token, 'insert_backup', backup),

  deleteBackup: (token: string, backupId: string) =>
    callProxy(token, 'delete_backup', { backupId }),

  getTrash: (token: string, offset = 0, limit = 40) =>
    callProxy(token, 'get_trash', { offset, limit }),

  restoreBackup: (token: string, backupId: string) =>
    callProxy(token, 'restore_backup', { backupId }),

  hardDeleteBackup: (token: string, backupId: string) =>
    callProxy(token, 'hard_delete_backup', { backupId }),

  createAlbum: (token: string, name: string) =>
    callProxy(token, 'create_album', { name }),

  listAlbums: (token: string) =>
    callProxy(token, 'list_albums'),

  addToAlbum: (token: string, albumId: string, backupId: string) =>
    callProxy(token, 'add_to_album', { albumId, backupId }),

  removeFromAlbum: (token: string, albumId: string, backupId: string) =>
    callProxy(token, 'remove_from_album', { albumId, backupId }),

  getAlbumBackups: (token: string, albumId: string) =>
    callProxy(token, 'get_album_backups', { albumId }),

  getActivity: (token: string, limit = 50) =>
    callProxy(token, 'get_activity', { limit }),

  createShare: (token: string, backupId: string, shareCid: string, iv: string, mimeType: string | null, originalFilename: string | null, expiresInHours = 24) =>
    callProxy(token, 'create_share', { backupId, shareCid, iv, mimeType, originalFilename, expiresInHours }),

  listShares: (token: string) =>
    callProxy(token, 'list_shares'),

  revokeShare: (token: string, shareId: string) =>
    callProxy(token, 'revoke_share', { shareId }),

  getSharePublic: (shareId: string) =>
    callProxy('', 'get_share_public', { shareId }),

  getEncryptionKey: (token: string) =>
    callProxy(token, 'get_encryption_key'),

  saveEncryptionKey: (token: string, encryptedKeyBlob: string, keySalt: string, keyVersion = 1) =>
    callProxy(token, 'save_encryption_key', { encryptedKeyBlob, keySalt, keyVersion }),
}
