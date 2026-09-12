-- Drop existing shares table and recreate with new link-based sharing schema
drop table if exists public.shares cascade;

-- Create shares table for secure link-based file sharing
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  backup_id uuid not null references public.backups(id) on delete cascade,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  share_cid text not null,
  iv text not null,
  mime_type text,
  original_filename text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  view_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Create indexes for efficient queries
create index shares_backup_id_idx on public.shares (backup_id);
create index shares_owner_user_id_idx on public.shares (owner_user_id);
create index shares_expires_at_idx on public.shares (expires_at);

-- Enable RLS on shares table
alter table public.shares enable row level security;

-- RLS policy for owner management (defense-in-depth)
create policy "shares_owner_manage" on public.shares
  for all using (
    owner_user_id = (select id from public.users where privy_user_id = (auth.jwt() ->> 'sub'))
  );
