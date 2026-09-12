-- Create shares table for secure file sharing
create table if not exists public.shares (
  id uuid primary key default uuid_generate_v4(),
  backup_id uuid not null references public.backups(id) on delete cascade,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  share_token text unique not null,
  encrypted_share_key text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Create indexes for efficient queries
create index if not exists shares_backup_id_idx on public.shares (backup_id);
create index if not exists shares_owner_user_id_idx on public.shares (owner_user_id);
create index if not exists shares_share_token_idx on public.shares (share_token);
create index if not exists shares_expires_at_idx on public.shares (expires_at);

-- Enable RLS on shares table
alter table public.shares enable row level security;

-- RLS policies for shares
drop policy if exists shares_select_own_row on public.shares;
create policy shares_select_own_row
on public.shares
for select
to authenticated
using (
  owner_user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);

drop policy if exists shares_select_valid_token on public.shares;
create policy shares_select_valid_token
on public.shares
for select
to anon
using (
  share_token is not null
  and expires_at > now()
);

drop policy if exists shares_insert_own_row on public.shares;
create policy shares_insert_own_row
on public.shares
for insert
to authenticated
with check (
  owner_user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);

drop policy if exists shares_delete_own_row on public.shares;
create policy shares_delete_own_row
on public.shares
for delete
to authenticated
using (
  owner_user_id = (
    select id
    from public.users
    where privy_user_id = (select auth.uid())::text
  )
);
