// Vault session: the single in-memory holder of the unwrapped master key.
// Module scope deliberately — never localStorage/sessionStorage/cookies, so
// the key dies with the tab and is explicitly cleared on logout (see
// useAuth) and on pagehide. Components subscribe via useEncryption; direct
// importers must treat the key as transient and never persist it.

'use client'

import { setupVaultKey, unlockVaultKey } from './keyManagement'

let sessionKey: CryptoKey | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // A failing subscriber must not break unlock/lock for the rest.
    }
  }
}

export function subscribeVaultSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getVaultSessionKey(): CryptoKey | null {
  return sessionKey
}

export async function unlockVaultSession(passphrase: string, accessToken: string): Promise<CryptoKey> {
  const key = await unlockVaultKey(passphrase, accessToken)
  sessionKey = key
  notify()
  return key
}

export async function setupVaultSession(
  passphrase: string,
  confirmPassphrase: string,
  accessToken: string,
): Promise<CryptoKey> {
  const key = await setupVaultKey(passphrase, confirmPassphrase, accessToken)
  sessionKey = key
  notify()
  return key
}

export function lockVaultSession(): void {
  sessionKey = null
  notify()
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    sessionKey = null
  })
}
