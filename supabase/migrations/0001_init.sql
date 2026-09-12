create extension if not exists "uuid-ossp";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  privy_user_id text unique not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.encryption_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  encrypted_key_blob text not null,
  key_version integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.backups (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  cid text not null,
  original_filename text,
  original_hash text,
  mime_type text,
  encrypted_size bigint,
  original_size bigint,
  iv text not null,
  thumbnail_cid text,
  metadata_encrypted jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_privy_user_id_idx on public.users (privy_user_id);
create index if not exists encryption_keys_user_id_idx on public.encryption_keys (user_id);
create index if not exists backups_user_id_idx on public.backups (user_id);
create index if not exists backups_cid_idx on public.backups (cid);
create index if not exists backups_original_hash_idx on public.backups (original_hash);
create index if not exists backups_created_at_idx on public.backups (created_at desc);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists set_backups_updated_at on public.backups;
create trigger set_backups_updated_at
before update on public.backups
for each row
execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.encryption_keys enable row level security;
alter table public.backups enable row level security;

drop policy if exists users_select_own_row on public.users;
create policy users_select_own_row
on public.users
for select
to authenticated
using ((select auth.uid())::text = privy_user_id);

drop policy if exists users_insert_own_row on public.users;
create policy users_insert_own_row
on public.users
for insert
to authenticated
with check ((select auth.uid())::text = privy_user_id);

drop policy if exists users_update_own_row on public.users;
create policy users_update_own_row
on public.users
for update
to authenticated
using ((select auth.uid())::text = privy_user_id)
with check ((select auth.uid())::text = privy_user_id);

drop policy if exists users_delete_own_row on public.users;
create policy users_delete_own_row
on public.users
for delete
to authenticated
using ((select auth.uid())::text = privy_user_id);

drop policy if exists encryption_keys_select_own_row on public.encryption_keys;
create policy encryption_keys_select_own_row
on public.encryption_keys
for select
to authenticated
using (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);

drop policy if exists encryption_keys_insert_own_row on public.encryption_keys;
create policy encryption_keys_insert_own_row
on public.encryption_keys
for insert
to authenticated
with check (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);

drop policy if exists encryption_keys_update_own_row on public.encryption_keys;
create policy encryption_keys_update_own_row
on public.encryption_keys
for update
to authenticated
using (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
)
with check (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);

drop policy if exists encryption_keys_delete_own_row on public.encryption_keys;
create policy encryption_keys_delete_own_row
on public.encryption_keys
for delete
to authenticated
using (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);

drop policy if exists backups_select_own_row on public.backups;
create policy backups_select_own_row
on public.backups
for select
to authenticated
using (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);

drop policy if exists backups_insert_own_row on public.backups;
create policy backups_insert_own_row
on public.backups
for insert
to authenticated
with check (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);

drop policy if exists backups_update_own_row on public.backups;
create policy backups_update_own_row
on public.backups
for update
to authenticated
using (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
)
with check (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);

drop policy if exists backups_delete_own_row on public.backups;
create policy backups_delete_own_row
on public.backups
for delete
to authenticated
using (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);
