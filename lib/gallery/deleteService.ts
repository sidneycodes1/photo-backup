import { supabaseProxy } from '@/lib/api/supabaseProxy'

export async function deleteBackup(backupId: string, accessToken: string): Promise<void> {
  if (!backupId.trim()) {
    throw new Error('A backup ID is required to delete a backup')
  }

  await supabaseProxy.deleteBackup(accessToken, backupId)
}
