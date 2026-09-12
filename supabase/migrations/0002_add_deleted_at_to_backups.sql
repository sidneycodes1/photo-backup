-- Add deleted_at column for soft-delete functionality
alter table public.backups add column if not exists deleted_at timestamptz;

-- Create index for efficient trash queries
create index if not exists backups_deleted_at_idx on public.backups (deleted_at desc);

-- Update RLS policy to exclude soft-deleted items by default
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
  and deleted_at is null
);
