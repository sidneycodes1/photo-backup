import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg border-border bg-card">
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>The page you asked for does not exist in Vaultly.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/gallery">Return to gallery</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
