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
          <p className="mt-3 text-sm font-medium">Only you control the key</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The vault key is wrapped with your Privy identity and never stored raw on the server.
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
          <p className="mt-3 text-sm font-medium">Key refresh is local</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Regenerating your key only rewrites the wrapped key blob. It does not send raw key material to Vaultly.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
