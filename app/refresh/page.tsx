'use client'

import { useEffect, Suspense } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function RefreshContent() {
  const { ready, authenticated, getAccessToken } = usePrivy()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!ready) return

    let isMounted = true

    const redirectUri = searchParams.get('redirect_uri') ?? '/gallery'

    async function refreshSession() {
      const token = await getAccessToken()

      if (!isMounted) return

      if (token) {
        router.replace(redirectUri)
        return
      }

      router.replace('/login')
    }

    void refreshSession()

    return () => {
      isMounted = false
    }
  }, [getAccessToken, ready, router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Refreshing session</CardTitle>
          <CardDescription>{authenticated ? 'Syncing your access token before continuing.' : 'Checking whether you still have an active session.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/3" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function RefreshPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Refreshing session</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      </div>
    }>
      <RefreshContent />
    </Suspense>
  )
}
