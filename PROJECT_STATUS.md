# Vaultly — Project Status

Last updated: 2026-09-13, at commit `1f22a2f` (first push to GitHub).

## What has been completed

- **Core features, all working end-to-end (verified live, not just typechecked)**:
  encrypted upload (EXIF strip, SHA-256 dedup, AES-256-GCM, chunked for
  large files), gallery with pagination/filter/sort, trash (soft delete →
  restore → hard delete), albums, activity feed, secure link-based sharing
  (no recipient account needed, share key never touches the server).
- **Auth bridge**: Privy → JWT → `jose`/JWKS verification → Supabase admin
  client, scoped by `privy_user_id` on every operation.
- **Vault key security (hardened)**: replaced the original
  `privy_user_id`-derived key (which the server could theoretically
  re-derive) with a real passphrase-based design — PBKDF2-SHA256, 600,000
  iterations, random per-user salt (`encryption_keys.key_salt`). Users now
  set a passphrase on first use and unlock the vault each session. **If a
  user forgets this passphrase, their data is permanently unrecoverable —
  this is intentional and correct, not a bug.**
- **Security audit fixes applied**: JWT audience check added, `expiresInHours`
  bounded, dead/leaking `/api/storage-stats` route deleted, migration 0010
  made idempotent, dead code removed (`serverAuth.ts`, `syncService.ts`,
  unused validation schemas).
- **Testing**: `npm run verify:all` runs typecheck → production build →
  live Supabase schema check → full Vitest suite (15 tests) using a mock
  Lighthouse storage adapter (`STORAGE_PROVIDER=mock`) so tests cost no
  Lighthouse credits.
- **Docs**: `README.md`, `docs/ARCHITECTURE.md`, `SECURITY.md`, `TESTING.md`
  all rewritten to match actual current code (no stale Storacha/Uppy
  Dashboard references).
- **UI/UX pass**: design tokens, framer-motion transitions, empty states,
  skeleton loaders, toast micro-feedback across all screens.
- **Pushed to GitHub**: commit `1f22a2f`, `gitleaks` clean (both git-history
  and working-tree scans), file manifest reviewed, no secrets committed.
  Repo is currently **private**.

## What is currently broken / known gaps

- **Nothing is deployed to production.** Everything above has only been
  run locally (`localhost:3000`) and verified via the terminal test suite.
  There is no live Vercel (or other) deployment yet — this is the single
  biggest remaining gap, not a small one.
- **No automated cleanup jobs.** Trash shows a 30-day countdown but nothing
  actually deletes rows when it expires; same for expired/revoked shares.
  Both need a cron mechanism (Vercel Cron vs. a Supabase scheduled function)
  — this is an infrastructure/cost decision, not yet made.
- **Hard delete removes metadata only.** The ciphertext blob stays
  addressable on IPFS by CID (content-addressed storage has no reliable
  delete). Documented in the README, not a bug to fix so much as a
  permanent architectural fact to keep communicating honestly.
- **Thumbnails aren't a real separate pipeline.** The gallery decrypts the
  full file client-side and downscales for preview. `thumbnail_cid` exists
  in the schema but nothing populates it yet.
- **`npm audit`: 37 findings remain** (down from 44), all requiring a
  breaking Privy major-version bump (`viem`/`ws` chain) — deliberately
  deferred, not forgotten.
- **Sentry is wired in code but its live delivery was never actually
  verified** (i.e., nobody confirmed a deliberately-triggered error shows
  up in the Sentry dashboard). Treat it as "present, unconfirmed" until
  checked.
- **Lighthouse account status is unclear.** Hit a 403/quota restriction on
  the free trial earlier in the project; it appears to be working again
  now (a successful real upload was confirmed), but whether that's because
  the trial reset, quota freed up, or something else wasn't determined.
  **Check current plan/usage at files.lighthouse.storage before relying on
  it for anything beyond light testing.**

## What I was working on most recently

Finishing the pre-push hardening pass (passphrase vault key + security
audit fixes) and doing the first-ever commit/push to GitHub. That's now
done and verified (`verify:all` 15/15, gitleaks clean on the pushed
commit). The repo is sitting private, one manual step short of going
public (see Next step).

## What remains to build

1. **Deploy to Vercel** (or chosen host) — has never actually been done.
2. Decide and implement a cron mechanism for trash purge + share expiry
   cleanup.
3. Verify Sentry actually delivers errors in a live/deployed environment.
4. Real encrypted thumbnail pipeline (separate small ciphertext + its own
   CID/IV, instead of downscaling the full decrypted file client-side).
5. Streaming/chunked re-encryption for sharing large files (currently
   memory-bound).
6. Address remaining `npm audit` findings when doing the next Privy major
   version upgrade.
7. Run and record the one manual check `TESTING.md` calls out: a real
   funded-Lighthouse upload + retrieval, outside of mock-storage tests.

## Next step when I return

1. Open `.env.example`, confirm every value is a placeholder (not a real
   key) — 30 second check.
2. Flip the GitHub repo to Public; confirm Settings → Code security shows
   secret scanning as enabled (auto-enables for public repos); enable
   Dependabot alerts.
3. Pick a deployment target (Vercel is the intended one per the original
   architecture docs) and actually deploy — this hasn't happened yet.
4. Decide the cron approach for trash/share cleanup and implement it.

## Important dependencies / services (what you'll need to log back into)

| Service | What it's for | Notes |
|---|---|---|
| **Supabase** (project: `phot-backup`) | Postgres metadata, auth bridge target | Free tier. All migrations `0001`–`0012` applied live. |
| **Privy** | Identity/auth (JWT issuer) | App ID + verification key needed in env. |
| **Lighthouse Storage** (files.lighthouse.storage) | Encrypted blob storage (IPFS/Filecoin) | **Check plan/quota status** — see gap noted above. |
| **GitHub** (`sidneycodes1/photo-backup`) | Source control | Currently private, first commit pushed. |
| **Vercel** | Intended deployment target | **Not yet actually deployed.** |
| **Sentry** | Error monitoring (optional) | DSN configured in env; live delivery unverified. |

Every env var needed and where to get each one is documented in full in
`README.md` under "Environment variables" — that table is accurate as of
this commit, use it rather than re-deriving from memory.
