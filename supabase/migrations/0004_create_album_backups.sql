-- Create album_backups join table
create table if not exists public.album_backups (
  album_id uuid not null references public.albums(id) on delete cascade,
  backup_id uuid not null references public.backups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (album_id, backup_id)
);

-- Create indexes for efficient queries
create index if not exists album_backups_album_id_idx on public.album_backups (album_id);
create index if not exists album_backups_backup_id_idx on public.album_backups (backup_id);

-- Enable RLS on album_backups table
alter table public.album_backups enable row level security;

-- RLS policies for album_backups (enforced via album ownership)
drop policy if exists album_backups_select_via_album on public.album_backups;
create policy album_backups_select_via_album
on public.album_backups
for select
to authenticated
using (
  album_id in (
    select id
    from public.albums
    where user_id = (
      select id
      from public.users
      where privy_user_id = (select auth.uid())::text
    )
  )
);

drop policy if exists album_backups_insert_via_album on public.album_backups;
create policy album_backups_insert_via_album
on public.album_backups
for insert
to authenticated
with check (
  album_id in (
    select id
    from public.albums
    where user_id = (
      select id
      from public.users
      where privy_user_id = (select auth.uid())::text
    )
  )
);

drop policy if exists album_backups_delete_via_album on public.album_backups;
create policy album_backups_delete_via_album
on public.album_backups
for delete
to authenticated
using (
  album_id in (
    select id
    from public.albums
    where user_id = (
      select id
      from public.users
      where privy_user_id = (select auth.uid())::text
    )
  )
);
