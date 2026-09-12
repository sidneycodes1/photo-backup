-- Phase-1, read-only catalog audit. This replaces the first version of the
-- verification RPC with the complete set of checks needed by Vaultly.
drop function if exists public.vaultly_schema_status();

create function public.vaultly_schema_status()
returns table (
  schema_check_version integer,
  table_name text,
  table_present boolean,
  rls_enabled boolean,
  rls_policy_count integer,
  deleted_at_present boolean,
  user_id_unique boolean,
  shares_missing_columns text[],
  album_backups_composite_primary_key boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with expected(table_name) as (
    values
      ('users'::text),
      ('encryption_keys'::text),
      ('backups'::text),
      ('albums'::text),
      ('album_backups'::text),
      ('shares'::text)
  ), relations as (
    select c.oid, c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  )
  select
    2 as schema_check_version,
    e.table_name,
    r.oid is not null as table_present,
    coalesce(r.relrowsecurity, false) as rls_enabled,
    coalesce((select count(*)::integer from pg_policy p where p.polrelid = r.oid), 0) as rls_policy_count,
    case when e.table_name = 'backups' then exists (
      select 1 from pg_attribute a
      where a.attrelid = r.oid
        and a.attname = 'deleted_at'
        and a.attnum > 0
        and not a.attisdropped
    ) else null end as deleted_at_present,
    case when e.table_name = 'encryption_keys' then exists (
      select 1
      from pg_constraint con
      where con.conrelid = r.oid
        and con.contype = 'u'
        and array_length(con.conkey, 1) = 1
        and con.conkey[1] = (
          select a.attnum
          from pg_attribute a
          where a.attrelid = r.oid
            and a.attname = 'user_id'
            and a.attnum > 0
            and not a.attisdropped
        )
    ) else null end as user_id_unique,
    case when e.table_name = 'shares' then array(
      select required.column_name
      from unnest(array[
        'backup_id', 'owner_user_id', 'share_cid', 'iv', 'mime_type',
        'original_filename', 'expires_at', 'revoked_at', 'view_count'
      ]::text[]) as required(column_name)
      where not exists (
        select 1 from pg_attribute a
        where a.attrelid = r.oid
          and a.attname = required.column_name
          and a.attnum > 0
          and not a.attisdropped
      )
    ) else null end as shares_missing_columns,
    case when e.table_name = 'album_backups' then exists (
      select 1
      from pg_constraint con
      where con.conrelid = r.oid
        and con.contype = 'p'
        and array_length(con.conkey, 1) = 2
        and con.conkey @> array[
          (select a.attnum from pg_attribute a where a.attrelid = r.oid and a.attname = 'album_id' and a.attnum > 0 and not a.attisdropped),
          (select a.attnum from pg_attribute a where a.attrelid = r.oid and a.attname = 'backup_id' and a.attnum > 0 and not a.attisdropped)
        ]::smallint[]
    ) else null end as album_backups_composite_primary_key
  from expected e
  left join relations r on r.relname = e.table_name
  order by e.table_name;
$$;

revoke all on function public.vaultly_schema_status() from public;
grant execute on function public.vaultly_schema_status() to service_role;
