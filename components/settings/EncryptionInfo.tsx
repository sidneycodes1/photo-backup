import { Shield, Lock, KeyRound } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function EncryptionInfo() {
  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base">End-to-end encryption</CardTitle>
        <CardDescription>Vaultly encrypts on your device before any upload leaves the browser.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background p-4">
          <Shield className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm font-medium">Only your passphrase unlocks it</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The vault key is wrapped with a key derived from your passphrase (PBKDF2, 600,000 iterations) and never stored raw anywhere.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <Lock className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm font-medium">Encrypted before upload</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Photos and videos are stripped of metadata, encrypted locally, and uploaded as opaque blobs.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <KeyRound className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm font-medium">Locked every session</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The unwrapped key lives only in this tab&apos;s memory. It is cleared on logout or tab close — unlocking takes your passphrase each time.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
