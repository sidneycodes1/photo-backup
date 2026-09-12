'use client'

import { usePrivy } from '@privy-io/react-auth'

export function useUserProfile() {
  const { user, authenticated } = usePrivy()

  const email = user?.email?.address ?? user?.google?.email ?? null
  const name = user?.google?.name ?? email?.split('@')[0] ?? 'Vaultly User'

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const avatarUrl =
    user?.linkedAccounts
      .map((account) => (account as { profilePictureUrl?: string | null }).profilePictureUrl ?? null)
      .find((url): url is string => typeof url === 'string' && url.length > 0) ?? null

  return { email, name, initials, avatarUrl, authenticated }
}
