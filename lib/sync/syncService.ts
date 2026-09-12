// CLIENT-SIDE ONLY

import { useUploadStore } from '@/store/uploadStore'
import type { UploadQueueItem } from '@/types'

const PENDING_STATUSES: UploadQueueItem['status'][] = ['pending', 'encrypting', 'uploading', 'error']

export async function checkPendingUploads(): Promise<UploadQueueItem[]> {
  if (typeof window === 'undefined') {
    return []
  }

  const queue = useUploadStore.getState().uploadQueue
  return queue.filter((item) => PENDING_STATUSES.includes(item.status))
}
