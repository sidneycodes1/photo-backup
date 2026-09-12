import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const requiredTables = [
  'users',
  'encryption_keys',
  'backups',
  'albums',
  'album_backups',
  'shares',
] as const

type SchemaStatus = {
  schema_check_version: number
  table_name: string
  table_present: boolean
  rls_enabled: boolean
  rls_policy_count: number
  deleted_at_present: boolean | null
  user_id_unique: boolean | null
  shares_missing_columns: string[] | null
  album_backups_composite_primary_key: boolean | null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  // This is deliberately an admin client. PostgREST does not expose pg_catalog
  // directly, so the read-only RPC below queries pg_class/pg_attribute/
  // pg_constraint inside Postgres and returns only the required metadata.
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin.rpc('vaultly_schema_status')
  if (error) {
    throw new Error(
      `Unable to run the deployed schema check: ${error.message}. ` +
        'Apply supabase/migrations/0009_expand_schema_verification.sql, then rerun this command.',
    )
  }

  const statuses = (data ?? []) as SchemaStatus[]
  if (!statuses.length || statuses.some((status) => status.schema_check_version !== 2)) {
    throw new Error(
      'The deployed schema check is outdated. Apply supabase/migrations/0009_expand_schema_verification.sql, then rerun this command.',
    )
  }
  const found = new Map(statuses.map((status) => [status.table_name, status]))
  const missingTables = requiredTables.filter((name) => !found.get(name)?.table_present)
  const rlsDisabled = requiredTables.filter((name) => found.get(name)?.rls_enabled !== true)
  const missingPolicies = requiredTables.filter((name) => (found.get(name)?.rls_policy_count ?? 0) < 1)
  const missingDeletedAt = found.get('backups')?.deleted_at_present !== true
  const missingUnique = found.get('encryption_keys')?.user_id_unique !== true
  const missingShareColumns = found.get('shares')?.shares_missing_columns ?? []
  const missingAlbumBackupsPrimaryKey = found.get('album_backups')?.album_backups_composite_primary_key !== true

  console.log('Vaultly schema verification')
  for (const name of requiredTables) {
    const table = found.get(name)
    console.log(
      `${name}: ${table?.table_present ? 'present' : 'MISSING'}; ` +
        `RLS: ${table?.rls_enabled ? 'enabled' : 'DISABLED'}; ` +
        `policies: ${table?.rls_policy_count ?? 0}`,
    )
  }
  console.log(`backups.deleted_at: ${missingDeletedAt ? 'MISSING' : 'present'}`)
  console.log(`encryption_keys.user_id UNIQUE: ${missingUnique ? 'MISSING' : 'present'}`)
  console.log(
    `shares required columns: ${missingShareColumns.length ? `MISSING (${missingShareColumns.join(', ')})` : 'present'}`,
  )
  console.log(
    `album_backups composite primary key (album_id, backup_id): ${missingAlbumBackupsPrimaryKey ? 'MISSING' : 'present'}`,
  )

  if (
    missingTables.length ||
    rlsDisabled.length ||
    missingPolicies.length ||
    missingDeletedAt ||
    missingUnique ||
    missingShareColumns.length ||
    missingAlbumBackupsPrimaryKey
  ) {
    throw new Error(
      [
        missingTables.length ? `Missing tables: ${missingTables.join(', ')}` : '',
        rlsDisabled.length ? `RLS disabled: ${rlsDisabled.join(', ')}` : '',
        missingPolicies.length ? `RLS policies missing: ${missingPolicies.join(', ')}` : '',
        missingDeletedAt ? 'Missing column: backups.deleted_at' : '',
        missingUnique
          ? 'Missing UNIQUE constraint: encryption_keys.user_id (apply supabase/migrations/0008_add_encryption_keys_user_id_unique.sql)'
          : '',
        missingShareColumns.length ? `Missing shares columns: ${missingShareColumns.join(', ')}` : '',
        missingAlbumBackupsPrimaryKey
          ? 'Missing composite primary key: album_backups(album_id, backup_id)'
          : '',
      ]
        .filter(Boolean)
        .join('; '),
    )
  }

  console.log('Schema verification passed.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
