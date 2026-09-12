import { z } from 'zod'

export const CreateBackupSchema = z
  .object({
    cid: z.string().min(1),
    iv: z.string().min(1),
    mimeType: z.string().min(1),
    encryptedSize: z.number().int().nonnegative(),
    originalSize: z.number().int().nonnegative(),
    originalHash: z.string().min(1),
    originalFilename: z.string().min(1),
    thumbnailCid: z.string().min(1).nullable().optional(),
    metadataEncrypted: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()

export const BackupQuerySchema = z
  .object({
    page: z.coerce.number().int().min(0).default(0),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['newest', 'oldest']).default('newest'),
    mediaFilter: z.enum(['all', 'photos', 'videos']).default('all'),
  })
  .strict()

export const RestoreRequestSchema = z
  .object({
    backupId: z.string().uuid(),
    cid: z.string().min(1),
    iv: z.string().min(1),
    mimeType: z.string().min(1),
    originalFilename: z.string().min(1).nullable().optional(),
    thumbnailCid: z.string().min(1).nullable().optional(),
  })
  .strict()

export type CreateBackupInput = z.infer<typeof CreateBackupSchema>
export type BackupQueryInput = z.infer<typeof BackupQuerySchema>
export type RestoreRequestInput = z.infer<typeof RestoreRequestSchema>
