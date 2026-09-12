-- Read-only deployment verification for scripts/verify-schema.ts.
-- PostgREST intentionally does not expose pg_catalog, so this narrowly scoped
-- RPC is the only way for the admin client to inspect catalog metadata.
create or replace function public.vaultly_schema_status()
returns table (
  table_name text,
  table_present boolean,
  rls_enabled boolean,
  deleted_at_present boolean,
  user_id_unique boolean
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
    e.table_name,
    r.oid is not null as table_present,
    coalesce(r.relrowsecurity, false) as rls_enabled,
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
    ) else null end as user_id_unique
  from expected e
  left join relations r on r.relname = e.table_name
  order by e.table_name;
$$;

revoke all on function public.vaultly_schema_status() from public;
grant execute on function public.vaultly_schema_status() to service_role;
