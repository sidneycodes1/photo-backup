'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type AppErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // Keep the production UI quiet; detailed diagnostics stay in dev.
      console.error(error)
    }
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg border-border bg-card">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            Vaultly hit an unexpected error while loading this screen. Your encrypted media and metadata are untouched.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/gallery">Go to gallery</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
