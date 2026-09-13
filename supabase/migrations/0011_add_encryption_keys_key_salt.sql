-- Passphrase-hardened vault keys: each vault stores a random per-vault salt
-- (plaintext; salts are not secret) next to its AES-KW-wrapped master key.
-- Rows written by the pre-passphrase scheme have NULL key_salt, can never be
-- unwrapped again, and are overwritten by the next passphrase setup (upsert on
-- user_id). Pre-production: no data migration attempted; affected dev rows
-- simply require a fresh passphrase setup.
alter table public.encryption_keys
  add column if not exists key_salt text;
