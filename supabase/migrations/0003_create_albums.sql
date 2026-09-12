-- Create albums table
create table if not exists public.albums (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Create index for efficient user album queries
create index if not exists albums_user_id_idx on public.albums (user_id);

-- Enable RLS on albums table
alter table public.albums enable row level security;

-- RLS policies for albums
drop policy if exists albums_select_own_row on public.albums;
create policy albums_select_own_row
on public.albums
for select
to authenticated
using (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);

drop policy if exists albums_insert_own_row on public.albums;
create policy albums_insert_own_row
on public.albums
for insert
to authenticated
with check (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);

drop policy if exists albums_update_own_row on public.albums;
create policy albums_update_own_row
on public.albums
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

drop policy if exists albums_delete_own_row on public.albums;
create policy albums_delete_own_row
on public.albums
for delete
to authenticated
using (
  user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);
