# Vaultly

Vaultly is a privacy-first photo and video backup app that gives you the convenience of Google Photos without giving a third party access to your memories. Photos and videos are encrypted locally in the browser before upload, stored as opaque ciphertext on Storacha, and tracked in Supabase as metadata only.

## Architecture

```text
User selects file in browser
        |
        v
Strip EXIF / metadata locally
        |
        v
AES-256-GCM encrypt on-device
        |
        v
Upload encrypted blob through a protected server route
        |
        v
Storacha stores encrypted blob
        |
        v
Storacha returns CID
        |
        v
Store CID + IV + hashes + mime type in Supabase
```

```text
Privy -> authentication and persistent sessions
Supabase -> metadata only (users, keys, backups)
Storacha -> encrypted media blobs only
Browser -> encryption, decryption, restore, thumbnail rendering
```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your local environment file:
   ```bash
   copy .env.example .env.local
   ```
3. Fill in all required variables in `.env.local`.
4. Create a Supabase project and run `supabase/migrations/0001_init.sql`.
5. Configure your Privy app and Storacha space/proof.
6. Start the app:
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Client | Base URL for redirects and links |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Client | Privy application ID |
| `PRIVY_VERIFICATION_KEY` | Server | Verifies Privy JWTs in middleware |
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Trusted metadata writes only |
| `STORACHA_PRINCIPAL` | Server | Storacha DID principal |
| `STORACHA_PROOF` | Server | Storacha delegation proof |
| `NEXT_PUBLIC_SENTRY_DSN` | Client | Optional Sentry browser DSN |
| `SENTRY_DSN` | Server | Optional Sentry server DSN |

## Deployment Guide

Follow the phase 5 deployment checklist in this README before merging to production:

1. Provision Supabase and run the SQL migration.
2. Configure Privy and copy the app ID and verification key.
3. Create the Storacha space and generate the principal/proof.
4. Add all environment variables in Vercel.
5. Verify the full flow: upload, logout, login, gallery, restore, delete.

## Security Model

- All media encryption happens in the browser using Web Crypto AES-256-GCM.
- EXIF stripping happens locally before encryption.
- Supabase stores only metadata and wrapped key blobs.
- Storacha stores only encrypted blobs, never plaintext media.
- Encrypted uploads are sent through a protected server route so Storacha credentials stay server-only.
- RLS is enabled on all Supabase tables.
- Protected API routes are guarded in middleware and re-validated server-side.
- Duplicate files are detected by SHA-256 hash before encryption/upload work begins.
- Error responses avoid leaking raw database or infrastructure details.

## Production Checklist

Use the phase 5 checklist in the task prompt before shipping Vaultly to production. The required end-to-end test is:

1. Sign in.
2. Upload a photo or video.
3. Log out.
4. Log back in.
5. Confirm the gallery shows the backup.
6. Restore the file.
7. Delete the backup metadata row.

## Notes

- Supabase Storage is intentionally not used.
- Storacha is the only media storage backend.
- Client-side encryption is mandatory for every upload path.
