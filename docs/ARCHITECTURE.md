# Vaultly Architecture

This is the deep version of the README's architecture section. It describes the
data flow of each major operation, the Privy → Supabase auth bridge, and the
encryption design — precisely enough that a new engineer can trace any request
from browser to database to storage and back.

## Components

- **Browser**: all encryption, decryption, EXIF stripping, hashing, thumbnail
  rendering, and share-key handling. Holds the unwrapped vault key in memory
  only. Source: `lib/encryption/*`, `lib/upload/uploadService.ts`,
  `lib/restore/restoreService.ts`, `lib/sharing/*`, `hooks/useEncryption.ts`.
- **Next.js server**: two secret-holding routes plus one protected stats route.
  Holds `SUPABASE_SERVICE_ROLE_KEY`, `LIGHTHOUSE_API_KEY`, and
  `PRIVY_VERIFICATION_KEY`. Never sees plaintext files or unwrapped keys.
- **`POST /api/supabase-proxy`**: the only privileged database path. Verifies
  the Privy JWT, resolves `users.id` from `privy_user_id`, validates the payload
  with Zod (`lib/validations/proxy.ts`), and runs ownership-scoped queries with
  the service-role admin client (`lib/supabase/admin.ts`).
- **`POST /api/lighthouse-upload`**: accepts an already-encrypted blob plus a
  Privy token, verifies the token, and calls `lighthouse.uploadBuffer` with the
  server-side API key. Enforces a 500 MB encrypted-payload cap.
- **Privy**: identity provider and JWT issuer. The browser authenticates with
  Privy (`@privy-io/react-auth`); the server verifies with `jose`.
- **Supabase Postgres**: metadata only — `users`, `encryption_keys`,
  `backups`, `albums`, `album_backups`, `shares`. No file bytes.
- **Lighthouse / IPFS**: ciphertext blobs only, addressed by CID, retrieved
  over public gateways (`gateway.lighthouse.storage` first, then `ipfs.io`,
  `cloudflare-ipfs.com`, `dweb.link`).

Key files: `app/api/supabase-proxy/route.ts`,
`app/api/lighthouse-upload/route.ts`, `lib/auth/verifyPrivyToken.ts`,
`middleware.ts`, `lib/encryption/fileEncryption.ts`,
`lib/encryption/fileDecryption.ts`, `lib/encryption/keyManagement.ts`,
`lib/encryption/vaultSession.ts`, `hooks/useEncryption.ts`,
`lib/lighthouse/client.ts`, `lib/lighthouse/retrieve.ts`,
`lib/lighthouse/provider.ts`, `lib/lighthouse/mockClient.ts`.

## Auth bridge: Privy JWT → `jose`/JWKS → admin client

1. The browser signs in via Privy and calls `getAccessToken()` for a
   short-lived JWT whose `sub` claim is the `privy_user_id`.
2. For database work the browser sends that token as the `token` field of the
   `POST /api/supabase-proxy` JSON body (for uploads, as the multipart `token`
   field to `/api/lighthouse-upload`). The raw Supabase service-role key is
   never exposed; the browser never talks to Postgres with privileges.
3. The route calls `verifyPrivyToken(token)` (`lib/auth/verifyPrivyToken.ts`),
   which verifies with `jose`'s `createRemoteJWKSet` against
   `https://auth.privy.io/api/v1/apps/<app_id>/jwks.json` (issuer `privy.io`,
   audience = the Privy app ID, 10-minute JWKS cache). Failure throws and the
   route returns 401/400 with a generic message. A factory
   (`createPrivyTokenVerifier`) lets tests inject a test JWKS and audience
   while production always uses Privy's remote set and app ID.
4. On success the route has a `privyUserId` and resolves the internal user:
   `users` lookup by `privy_user_id` → `users.id`. Every subsequent operation
   scopes by that id (`backups.user_id`, `albums.user_id`,
   `shares.owner_user_id`, `encryption_keys.user_id`), including join checks
   (e.g. `create_share` first verifies the backup belongs to the caller;
   `get_album_backups` first verifies the album belongs to the caller).
5. All queries run through `getAdminClient()` (service-role, no session
   persistence), which bypasses RLS by design. RLS policies remain enabled on
   every table as **defense-in-depth** — they constrain any future direct
   anon-key access path, but they are not the primary gate. The primary gate
   is steps 3–4 inside the proxy.
6. `middleware.ts` adds a second layer: it verifies the `privy-token` cookie
   with the static `PRIVY_VERIFICATION_KEY` (SPKI, pinned ES256, audience =
   Privy app ID) and applies per-IP/per-subject rate limits
   (`supabase-proxy` 30/min, `get_share_public` 10/min unauthenticated,
   `lighthouse-upload` 20/min). The proxy and upload routes pass through
   middleware and enforce auth internally. (The former `/api/storage-stats`
   route was deleted; stats now flow through the proxy's `get_storage_stats`.)

## Data flows

### Upload

1. `UploadZone` queues files (`@uppy/core` as a restriction/queue helper only;
   the dropzone UI is custom). `uploadFile()` (`lib/upload/uploadService.ts`):
   - `stripExif(file)` redraws JPEG/JPG/HEIC/HEIF through a canvas so EXIF/GPS
     never leaves the device; other types pass through unchanged.
   - SHA-256 of the stripped bytes → `originalHash`.
   - `check_duplicate` via the proxy; a match throws `DuplicateFileError`
     before any encryption work.
   - `encryptFile(stripped, vaultKey)`: ≤ 20 MB (`CHUNK_SIZE`) is one AES-GCM
     encrypt with a fresh 12-byte IV; larger files are encrypted chunk by
     chunk, each chunk with its own IV, stored as
     `IV(12) || plainLength uint32BE || ciphertext+tag` records concatenated.
     Returns `{ encryptedBlob, iv }` where `iv` is the single IV (small files)
     or the first chunk's IV (large files, used as the chunked-format marker).
   - `uploadToLighthouse(encryptedBlob, filename, token)`: mock mode writes to
     `.test-storage/<mock-uuid>.bin`; otherwise POSTs the blob to
     `/api/lighthouse-upload`, which verifies the token and uploads server-side.
     Returns the CID.
2. The browser calls `insert_backup` via the proxy with `{ cid, iv, mime_type,
   encrypted_size, original_size, original_filename, original_hash }`.
   The row is scoped to the resolved `user_id`. The gallery picks it up via
   `get_backups` (paginated, `deleted_at IS NULL`, optional mime filter/sort).

Sequence: browser (strip → hash → dedup → encrypt) → upload route (verify →
`uploadBuffer` → CID) → proxy (verify → Zod → `backups` insert) → gallery
refetch.

### Gallery / restore

- `get_backups` returns rows mapped to `BackupRecord` (`cid`, `iv`, sizes,
  mime, filename, hash). Thumbnails are derived client-side: `useThumbnail`
  fetches the ciphertext by CID, decrypts with the vault key, and downscales —
  no separate thumbnail upload exists today (`thumbnail_cid` stays null).
- `restoreFile()` (`lib/restore/restoreService.ts`) validates metadata with
  `RestoreRequestSchema`, fetches the blob via `fetchWithRetry` (gateway
  fallback chain), detects chunked vs. single-shot format from the stored IV +
  header, decrypts, and triggers an `<a download>` with the original filename.
  Plaintext exists only as a browser `Blob`.

### Trash: soft delete, restore, hard delete

- `delete_backup` sets `backups.deleted_at = now()` scoped by
  `(id, user_id)`. `get_trash` lists `deleted_at IS NOT NULL` newest-first.
- `restore_backup` sets `deleted_at = NULL` scoped by `(id, user_id)`.
- `hard_delete_backup` deletes the row scoped by `(id, user_id)`. Only the
  metadata row is removed — the ciphertext blob remains on IPFS under its CID
  (see README limitations). There is **no cron**: the "auto-deletes in N days"
  label is computed client-side from `deleted_at + 30 days` for display only.

### Sharing: create, view, revoke

- **Create** (`lib/sharing/shareService.ts`, helper variant in
  `lib/sharing/shareEncryption.ts`): fetch ciphertext by vault CID → decrypt
  with the vault key → generate a fresh random AES-256-GCM share key + IV →
  encrypt → upload new ciphertext to a new share CID → `create_share` via the
  proxy (`backupId` ownership-checked, `expires_at = now + expiresInHours`,
  default 24 h) → export the share key to raw bytes, base64url-encode, and
  build `${origin}/share/<id>#key=<key>`. The key travels only in the fragment.
- **View** (`app/share/[id]/page.tsx` + `get_share_public`): the page parses
  `#key` from `window.location.hash`, imports it as a non-extractable AES-GCM
  decryption key, then calls the **unauthenticated** `get_share_public`
  operation, which selects only
  `(share_cid, iv, mime_type, original_filename, revoked_at, expires_at,
   view_count)` by share id, returns 404 when missing/revoked/expired,
   increments `view_count` via the atomic `increment_share_view_count` RPC
   (best-effort: a counter failure is logged but never breaks the view),
   and never sees the key. The browser fetches the
  share CID and decrypts locally. Wrong key → Web Crypto throws → generic
  "link is no longer available".
- **Revoke / expiry**: `revoke_share` sets `revoked_at` scoped by
  `(id, owner_user_id)`. `list_shares` returns only unexpired rows
  (`expires_at > now()`). Expired/revoked rows are rejected, not deleted —
  no cleanup job exists yet.

## Encryption details

- **Algorithm**: AES-256-GCM via Web Crypto (`AES-GCM`, 256-bit, 12-byte IV,
  16-byte tag). Constants in `lib/encryption/constants.ts`.
- **Per-file IV**: `generateIV()` uses `crypto.getRandomValues`. Small files:
  one IV per file, stored base64 in `backups.iv`. Large files: one IV per
  ~20 MB chunk; the stored IV is the first chunk's IV and doubles as the
  chunked-format detector on decrypt (`shouldUseChunkedDecrypt` checks IV
  match + header/length sanity before parsing records).
- **Integrity**: AES-GCM authentication tags per encrypt; large-file records
  additionally encode `plainLength` and fail closed on truncation or length
  mismatch. SHA-256 (`@noble/hashes`) of the stripped file provides dedup
  (`original_hash`), not integrity — integrity comes from GCM.
- **Vault key lifecycle** (`lib/encryption/keyManagement.ts`,
  session in `lib/encryption/vaultSession.ts`, UI in `hooks/useEncryption.ts`
  + `components/auth/VaultUnlock.tsx`): first use calls
  `setupVaultKey(passphrase, confirm, token)` — validates strength (≥12 chars,
  3-of-4 character classes), generates the AES-GCM master key and a random
  16-byte salt client-side, wraps with AES-KW, and saves
  `{ encrypted_key_blob, key_salt, key_version }` via the proxy (upsert on
  `user_id`, so pre-passphrase salt-less rows are overwritten). Each session
  calls `unlockVaultKey(passphrase, token)` — wrong passphrases fail closed in
  Web Crypto with a normalized error. The unwrapped key lives only in the
  module-level session holder, never in storage, and is cleared on logout
  (`useAuth`) and tab `pagehide`.
- **Wrapping**: wrapping key = PBKDF2-SHA256 with 600,000 iterations (OWASP
  floor), password = the vault passphrase, random 16-byte salt, 256 bits out,
  imported as AES-KW; vault key wrapped/unwrapped with AES-KW. Stored forms
  are base64 of the wrapped key and of the salt. The passphrase is never
  stored or transmitted, so the server (wrapped blob + salt only) can neither
  unwrap nor brute-force without it — at the accepted cost that a lost
  passphrase means unrecoverable data.
- **Sharing keys**: independent random AES-256-GCM keys per share, never
  wrapped under the vault key and never persisted. The vault key decrypts the
  original; the share key encrypts the copy. Compromise of a share link
  exposes only that file copy, never the vault.

## Storage details

- **Write path**: only `/api/lighthouse-upload` (server holds
  `LIGHTHOUSE_API_KEY`; `lighthouse.uploadBuffer`). The browser never calls
  Lighthouse with privileges.
- **Read path**: gateways only, no key. `fetchEncryptedBlob` tries
  `gateway.lighthouse.storage` then three public IPFS fallbacks and throws a
  joined error when all fail.
- **Mock mode**: `STORAGE_PROVIDER=mock` routes reads/writes to
  `.test-storage/*.bin` with `mock-<uuid>` CIDs (Node-only, `node:fs/promises`,
  CID-validated paths). Production and normal development default to
  `lighthouse`; tests opt into mock. Mock blobs are still genuinely encrypted
  — only the transport changes.
- **Deletion semantics**: IPFS is content-addressed and pinned by third
  parties; Vaultly's "delete" is metadata removal. Expired shares and
  hard-deleted backups leave ciphertext behind by design of the storage layer.
