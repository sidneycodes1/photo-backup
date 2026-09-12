-- Deliberately does not deduplicate existing rows. If this migration fails,
-- resolve the duplicate user_id values explicitly before rerunning it.
alter table public.encryption_keys
  add constraint encryption_keys_user_id_key unique (user_id);
