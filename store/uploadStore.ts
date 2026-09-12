import { create } from 'zustand'
import type { UploadProgress, UploadQueueItem } from '@/types'

type UploadProgressPatch = {
  status?: UploadQueueItem['status']
  encryptProgress?: number
  uploadProgress?: number
  phase?: UploadProgress['phase']
  encryption?: number
  upload?: number
  message?: string | null
  error?: string | null
}

type UploadStoreState = {
  uploadQueue: UploadQueueItem[]
  activeUploads: Map<string, UploadProgress>
  addToQueue: (file: File, id?: string) => string
  removeFromQueue: (id: string) => void
  updateProgress: (id: string, patch: UploadProgressPatch) => void
  clearQueue: () => void
}

function createInitialProgress(file: File): UploadProgress {
  return {
    fileName: file.name,
    fileSize: file.size,
    phase: 'selecting',
    encryption: 0,
    upload: 0,
    message: null,
    error: null,
  }
}

function createPreviewUrl(file: File): string | undefined {
  return file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
}

function revokePreviewUrl(item: UploadQueueItem | undefined) {
  if (item?.previewUrl) {
    URL.revokeObjectURL(item.previewUrl)
  }
}

export const useUploadStore = create<UploadStoreState>((set, get) => ({
  uploadQueue: [],
  activeUploads: new Map<string, UploadProgress>(),
  addToQueue(file, id = globalThis.crypto?.randomUUID?.() ?? `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`) {
    const previewUrl = createPreviewUrl(file)

    set((state) => {
      const existingItem = state.uploadQueue.find((item) => item.id === id)
      revokePreviewUrl(existingItem)

      const nextItem: UploadQueueItem = {
        id,
        file,
        status: 'pending',
        encryptProgress: 0,
        uploadProgress: 0,
        previewUrl,
      }

      const nextProgress = createInitialProgress(file)

      return {
        uploadQueue: [...state.uploadQueue.filter((item) => item.id !== id), nextItem],
        activeUploads: new Map(state.activeUploads).set(id, nextProgress),
      }
    })

    return id
  },
  removeFromQueue(id) {
    set((state) => {
      const removed = state.uploadQueue.find((item) => item.id === id)
      revokePreviewUrl(removed)

      const nextUploads = new Map(state.activeUploads)
      nextUploads.delete(id)

      return {
        uploadQueue: state.uploadQueue.filter((item) => item.id !== id),
        activeUploads: nextUploads,
      }
    })
  },
  updateProgress(id, patch) {
    set((state) => {
      const nextQueue = state.uploadQueue.map((item) => {
        if (item.id !== id) {
          return item
        }

        return {
          ...item,
          status: (patch.status ?? item.status) as UploadQueueItem['status'],
          encryptProgress: typeof patch.encryptProgress === 'number' ? patch.encryptProgress : item.encryptProgress,
          uploadProgress: typeof patch.uploadProgress === 'number' ? patch.uploadProgress : item.uploadProgress,
          error: patch.error === null ? undefined : typeof patch.error === 'string' ? patch.error : item.error,
        }
      })

      const previous = state.activeUploads.get(id)
      const nextProgress: UploadProgress = previous
        ? {
            ...previous,
            phase:
              (patch.phase as UploadProgress['phase'] | undefined) ??
              (patch.status === 'encrypting'
                ? 'encrypting'
                : patch.status === 'uploading'
                  ? 'uploading'
                  : patch.status === 'done'
                    ? 'done'
                    : patch.status === 'error'
                      ? 'error'
                      : previous.phase),
            encryption:
              typeof patch.encryption === 'number'
                ? patch.encryption
                : typeof patch.encryptProgress === 'number'
                  ? patch.encryptProgress
                  : previous.encryption,
            upload:
              typeof patch.upload === 'number'
                ? patch.upload
                : typeof patch.uploadProgress === 'number'
                  ? patch.uploadProgress
                  : previous.upload,
            error: patch.error === null ? null : typeof patch.error === 'string' ? patch.error : previous.error,
            message: typeof patch.message === 'string' ? patch.message : previous.message,
          }
        : {
            fileName: '',
            fileSize: 0,
            phase: 'idle',
            encryption: typeof patch.encryption === 'number' ? patch.encryption : 0,
            upload: typeof patch.upload === 'number' ? patch.upload : 0,
            message: typeof patch.message === 'string' ? patch.message : null,
            error: typeof patch.error === 'string' ? patch.error : null,
          }

      return {
        uploadQueue: nextQueue,
        activeUploads: new Map(state.activeUploads).set(id, nextProgress),
      }
    })
  },
  clearQueue() {
    get().uploadQueue.forEach((item) => revokePreviewUrl(item))
    set({
      uploadQueue: [],
      activeUploads: new Map(),
    })
  },
}))
