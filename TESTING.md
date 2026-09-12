# Terminal verification

Run the complete pre-push verification from a terminal:

```bash
npm run verify:all
```

It runs TypeScript type checking, a production build, the live Supabase schema
audit, and the Vitest suite. The suite uses `STORAGE_PROVIDER=mock` internally
for its storage tests. Mock uploads are encrypted normally and stored under the
ignored `.test-storage/` directory; no Lighthouse credits are used.

The proxy integration test uses a uniquely named disposable Supabase user and
deletes that user at the end of the test, including its cascaded test data.

## One remaining live-Lighthouse check

Mock storage verifies all encryption, upload/retrieve plumbing, auth, and
database flows. The only remaining unverified integration is a real
Lighthouse network upload and retrieval, which requires a funded Lighthouse
account.

Once the account is funded:

1. Set `STORAGE_PROVIDER=lighthouse` (or leave it unset, because Lighthouse is
   the production default) and set a valid `LIGHTHOUSE_API_KEY`.
2. Start the app, sign in, and upload one small non-sensitive file.
3. Confirm that it appears in the gallery.
4. Open it or restore it and confirm the downloaded/opened bytes match the
   original file.

That is the only manual check that consumes Lighthouse credits.
