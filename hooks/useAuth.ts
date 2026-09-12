'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { supabaseProxy } from '@/lib/api/supabaseProxy'
import type { LoginMethod } from '@/types'

export function useAuth() {
  const router = useRouter()
  const privy = usePrivy()
  const { ready, authenticated, user, getAccessToken, logout: privyLogout } = privy
  const upsertDone = useRef(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ready || !authenticated || !user || upsertDone.current) return
    upsertDone.current = true
    const email = user.email?.address ?? null

    async function syncUser() {
      try {
        const token = await getAccessToken()
        if (!token) return
        await supabaseProxy.upsertUser(token, email)
      } catch (e) {
        console.error('User sync failed:', e)
      }
    }

    syncUser()
  }, [ready, authenticated, user?.id])

  const { login } = useLogin({
    onComplete: async () => {
      // User is already upserted in useEffect, so just redirect
      router.replace('/')
    },
  })

  const loginWithMethods = (loginMethods: LoginMethod[]) => login({ loginMethods })

  const logout = useCallback(async () => {
    upsertDone.current = false
    queryClient.clear()  // ← ADD THIS LINE — clears all cached data
    await privyLogout()
  }, [privyLogout, queryClient])

  const logoutAndRedirect = useCallback(async () => {
    await logout()
    router.replace('/')
  }, [logout, router])

  return {
    ...privy,
    logout,
    logoutAndRedirect,
    login,
    loginWithMethods,
  }
}
