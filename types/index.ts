export type UUID = string
export type ISODateString = string

export type LoginMethod =
  | 'email'
  | 'google'
  | 'apple'
  | 'github'
  | 'discord'
  | 'twitter'
  | 'farcaster'
  | 'telegram'
  | 'sms'
  | 'passkey'

export type User = {
  id: UUID
  privyUserId: string
  email: string | null
  createdAt: ISODateString
  updatedAt: ISODateString
}

export type EncryptionKey = {
  id: UUID
  userId: UUID
  encryptedKeyBlob: string
  keyVersion: number
  createdAt: ISODateString
}

export type Backup = {
  id: UUID
  userId: UUID
  cid: string
  originalFilename: string | null
  originalHash: string | null
  mimeType: string | null
  encryptedSize: number | null
  originalSize: number | null
  iv: string
  thumbnailCid: string | null
  metadataEncrypted: Record<string, unknown> | null
  createdAt: ISODateString
  updatedAt: ISODateString
  deletedAt: ISODateString | null
}

export type BackupRecord = Backup

export type Album = {
  id: UUID
  userId: UUID
  name: string
  createdAt: ISODateString
}

export type Activity = {
  type: 'uploaded' | 'deleted' | 'restored'
  filename: string
  timestamp: ISODateString
  backupId: UUID
}

export type Share = {
  id: UUID
  backupId: UUID
  ownerUserId: UUID
  shareCid: string
  iv: string
  mimeType: string | null
  originalFilename: string | null
  expiresAt: ISODateString
  revokedAt: ISODateString | null
  viewCount: number
  createdAt: ISODateString
}

export type ThumbnailMetadata = {
  thumbnailIv: string
  thumbnailMimeType: string
  thumbnailEncryptedSize: number
}

export type StorageStats = {
  totalFiles: number
  totalEncryptedSize: number
  totalOriginalSize: number
}

export type GallerySortOrder = 'newest' | 'oldest'

export type GalleryMediaFilter = 'all' | 'photos' | 'videos'

export type UploadPhase = 'idle' | 'selecting' | 'stripping-exif' | 'encrypting' | 'uploading' | 'persisting' | 'done' | 'error'

export type UploadProgress = {
  fileName: string
  fileSize: number
  phase: UploadPhase
  encryption: number
  upload: number
  message: string | null
  error: string | null
}

export type UploadStatus = 'pending' | 'encrypting' | 'uploading' | 'done' | 'error'

export type UploadQueueItem = {
  id: string
  file: File
  status: UploadStatus
  encryptProgress: number
  uploadProgress: number
  previewUrl?: string
  error?: string
}

export type GalleryItem = Pick<
  Backup,
  'id' | 'cid' | 'originalFilename' | 'mimeType' | 'thumbnailCid' | 'createdAt' | 'originalSize' | 'encryptedSize'
>

export type AuthenticatedUser = {
  id: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
}
