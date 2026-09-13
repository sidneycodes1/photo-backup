import { z } from 'zod'

const uuid = z.string().uuid()

export const ProxyPayloadSchemas = {
  get_share_public: z.object({ shareId: uuid }).strict(),

  upsert_user: z.object({ email: z.string().email().nullable().optional() }).strict(),

  get_user: z.object({}).strict(),

  get_backups: z
    .object({
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      sortOrder: z.enum(['newest', 'oldest']).optional(),
      mediaFilter: z.enum(['all', 'photos', 'videos']).optional(),
    })
    .strict(),

  check_duplicate: z.object({ originalHash: z.string().min(1).max(128) }).strict(),

  get_storage_stats: z.object({}).strict(),

  insert_backup: z
    .object({
      cid: z.string().min(1).max(200),
      iv: z.string().min(1).max(100),
      mime_type: z.string().min(1).max(100),
      encrypted_size: z.number().int().nonnegative(),
      original_size: z.number().int().nonnegative(),
      original_filename: z.string().min(1).max(500),
      original_hash: z.string().min(1).max(128),
      thumbnail_cid: z.string().min(1).max(200).nullable().optional(),
      metadata_encrypted: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .strict(),

  delete_backup: z.object({ backupId: uuid }).strict(),

  get_trash: z
    .object({
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    })
    .strict(),

  restore_backup: z.object({ backupId: uuid }).strict(),

  hard_delete_backup: z.object({ backupId: uuid }).strict(),

  create_album: z.object({ name: z.string().trim().min(1).max(120) }).strict(),

  list_albums: z.object({}).strict(),

  add_to_album: z.object({ albumId: uuid, backupId: uuid }).strict(),

  remove_from_album: z.object({ albumId: uuid, backupId: uuid }).strict(),

  get_album_backups: z.object({ albumId: uuid }).strict(),

  get_activity: z.object({ limit: z.number().int().min(1).max(100).optional() }).strict(),

  create_share: z
    .object({
      backupId: uuid,
      shareCid: z.string().min(1).max(200),
      iv: z.string().min(1).max(100),
      mimeType: z.string().min(1).max(100).nullable().optional(),
      originalFilename: z.string().min(1).max(500).nullable().optional(),
      expiresInHours: z.number().finite().min(1).max(8760).optional(),
    })
    .strict(),

  list_shares: z.object({}).strict(),

  revoke_share: z.object({ shareId: uuid }).strict(),

  get_encryption_key: z.object({}).strict(),

  save_encryption_key: z
    .object({
      encryptedKeyBlob: z.string().min(1).max(10_000),
      keySalt: z.string().min(1).max(100),
      keyVersion: z.number().int().min(1).max(100).optional(),
    })
    .strict(),
} as const

export type ProxyOperation = keyof typeof ProxyPayloadSchemas

export function parseProxyPayload<O extends ProxyOperation>(
  operation: O,
  payload: unknown,
): z.infer<(typeof ProxyPayloadSchemas)[O]> {
  return ProxyPayloadSchemas[operation].parse(payload ?? {})
}

export function isProxyOperation(value: string): value is ProxyOperation {
  return value in ProxyPayloadSchemas
}
