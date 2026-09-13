# Security Policy

## Reporting a vulnerability

Email the maintainer directly: **see the repository owner's GitHub profile for
contact details** (do not open a public issue for a suspected vulnerability).

Please include:

- What you found and which commit or deployment it affects.
- Steps to reproduce (a minimal proof of concept is ideal).
- What an attacker could and could not do with it, in your assessment.
- Whether any real user data was accessed (we will treat accidental access
  during good-faith research as helpful, not hostile).

Guidelines:

- Do not access, modify, or exfiltrate other users' data beyond what is
  necessary to demonstrate the issue. Stop and report once you have a PoC.
- Do not perform denial-of-service, spam, or credential-stuffing tests against
  the production deployment.
- Ciphertext-only observations (e.g. "anyone with a CID can download the
  blob") are the documented storage design, not a vulnerability — the finding
  would need to show key recovery, plaintext recovery, or an auth bypass.

## Scope

In scope:

- Authentication/authorization bypass in `/api/supabase-proxy` or
  `/api/lighthouse-upload` (e.g. accessing another
  user's backups, keys, albums, or shares).
- Plaintext or key-material exposure (vault key, share key, or decrypted bytes
  reaching the server, logs, or a third party).
- Share-link flaws (revoked/expired links still yielding data, key leakage
  outside the URL fragment, `get_share_public` metadata oracle beyond its
  documented generic 404).
- Client-side encryption flaws (IV reuse, unauthenticated decryption,
  EXIF/hash handling that undermines dedup or privacy claims).

Out of scope (known design properties, documented in the README):

- Ciphertext remaining on IPFS after hard delete or share expiry.
- Missing automated trash/share-expiry purge (no cron exists yet).
- Passphrase-strength complaints about the documented no-recovery design
  (losing the passphrase means permanent data loss — that is intentional).
- Rate-limit tuning and generic CDN/gateway availability.

## Response expectations

Vaultly is maintained by a solo maintainer on a best-effort basis. Expected
handling:

- Acknowledgement within **7 days**.
- Triage and severity assessment within **14 days**.
- Fixes prioritized by severity (auth bypass / key exposure first); there is
  no paid bounty program.
- Public disclosure only after a fix is available, or 90 days after the
  report, whichever comes first — coordinated with you.

If the issue is actively being exploited, say so in the subject line and it
will be prioritized.
