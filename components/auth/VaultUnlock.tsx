// VaultUnlock: passphrase gate shown after Privy login until the in-memory
// vault key is available. Setup mode creates the first wrapped key; unlock
// mode unwraps the existing one. The passphrase itself is never stored —
// only the wrapped key blob and its salt reach the server.

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react'
import { useEncryption } from '@/hooks/useEncryption'
import { Button } from '@/components/ui/button'

const RULE_LABELS = [
  { id: 'length', label: 'At least 12 characters' },
  { id: 'classes', label: 'Lowercase, uppercase, digits, symbols — at least 3 of the 4' },
] as const

export function VaultUnlock({ mode }: { mode: 'needs-setup' | 'locked' }) {
  const { unlock, setupVault, isWorking, error } = useEncryption()
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')

  // Display-only mirror of validatePassphrase's two rules (enforcement lives
  // in the lib), so each checklist item lights up independently.
  const lengthOk = passphrase.length >= 12
  const classesOk =
    [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((pattern) => pattern.test(passphrase)).length >= 3
  const matches = passphrase === confirm
  const canSubmit =
    mode === 'locked' ? passphrase.length > 0 && !isWorking : lengthOk && classesOk && matches && !isWorking

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    if (mode === 'locked') {
      await unlock(passphrase)
    } else {
      const ok = await setupVault(passphrase, confirm)
      if (ok) {
        setPassphrase('')
        setConfirm('')
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md rounded-2xl border border-[#222222] bg-[#111111] p-8"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-foreground">
          {mode === 'locked' ? 'Unlock your vault' : 'Create your vault passphrase'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === 'locked'
            ? 'Enter your vault passphrase to decrypt your files on this device.'
            : 'This passphrase encrypts everything you store. Choose it carefully — it cannot be changed or recovered later.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="vault-passphrase" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Vault passphrase
            </label>
            <input
              id="vault-passphrase"
              type="password"
              autoComplete={mode === 'locked' ? 'current-password' : 'new-password'}
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          {mode === 'needs-setup' && (
            <div>
              <label htmlFor="vault-passphrase-confirm" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Confirm passphrase
              </label>
              <input
                id="vault-passphrase-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
              />
              <ul className="mt-3 space-y-1.5">
                {RULE_LABELS.map((rule) => {
                  const satisfied = rule.id === 'length' ? lengthOk : classesOk
                  return (
                    <li key={rule.id} className={`text-xs ${satisfied ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {satisfied ? '✓' : '•'} {rule.label}
                    </li>
                  )
                })}
                {confirm.length > 0 && (
                  <li className={`text-xs ${matches ? 'text-emerald-400' : 'text-destructive'}`}>
                    {matches ? '✓ Passphrases match' : '• Passphrases do not match'}
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-200/90">
              If you lose this passphrase, your files are gone forever. Nobody can recover them —
              not you, not Vaultly support. There is no reset, no recovery email, no backdoor.
              {mode === 'needs-setup' ? ' Store it in a password manager before continuing.' : ''}
            </p>
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error.message}
            </p>
          )}

          <Button type="submit" disabled={!canSubmit} className="h-11 w-full rounded-xl text-sm font-semibold">
            {isWorking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'locked' ? 'Unlock vault' : 'Create vault'}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
