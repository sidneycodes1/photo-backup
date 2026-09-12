// Optional Sentry client scaffold.
// Add @sentry/nextjs and initialize here when observability is enabled.
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (sentryDsn) {
  // Placeholder: wire @sentry/nextjs here in a future observability pass.
  void sentryDsn
}

export {}
