-- Atomic share view counter. The proxy used to read view_count and write it
-- back incremented, which loses counts under concurrent public views. This
-- RPC performs the increment in a single statement. It is invoked with the
-- service-role client from /api/supabase-proxy (best-effort: a failure is
-- logged but never breaks the share view), so no permissive RLS grant is
-- included; direct anon/authenticated execution is left revoked.
create or replace function public.increment_share_view_count(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shares
  set view_count = view_count + 1
  where id = p_share_id;
end;
$$;

revoke all on function public.increment_share_view_count(uuid) from public, anon, authenticated;
