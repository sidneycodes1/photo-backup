import { jwtVerify, importSPKI, decodeProtectedHeader } from 'jose'
import { createAdminClient } from '@/lib/supabase/admin'

const PRIVY_VERIFICATION_KEY = process.env.PRIVY_VERIFICATION_KEY!

export async function getVerifiedPrivyUserId(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...value] = c.trim().split('=')
      return [key, value.join('=')]
    })
  )
  const token = cookies['privy-token']
  if (!token) return null

  try {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
    if (!PRIVY_VERIFICATION_KEY || !appId) {
      console.error('Missing PRIVY_VERIFICATION_KEY or NEXT_PUBLIC_PRIVY_APP_ID')
      return null
    }

    const header = decodeProtectedHeader(token)
    const alg = header.alg
    if (alg !== 'RS256' && alg !== 'ES256') {
      console.error(`Unsupported algorithm: ${alg}`)
      return null
    }

    const publicKey = await importSPKI(PRIVY_VERIFICATION_KEY, alg)
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'privy.io',
      audience: appId,
    })

    return payload.sub || null
  } catch (err) {
    console.error('Error verifying Privy token:', err)
    return null
  }
}

export async function getVerifiedUserFromRequest(request: Request) {
  const privyUserId = await getVerifiedPrivyUserId(request)
  if (!privyUserId) return null

  const adminClient = createAdminClient()

  // First check if user exists
  const { data: user, error } = await adminClient
    .from('users')
    .select('*')
    .eq('privy_user_id', privyUserId)
    .maybeSingle()

  if (error) {
    console.error('Failed to lookup user:', error)
    return null
  }

  if (user) {
    return user
  }

  // If user doesn't exist, create them (upsert pattern)
  const { data: newUser, error: upsertError } = await adminClient
    .from('users')
    .upsert({ privy_user_id: privyUserId }, { onConflict: 'privy_user_id' })
    .select('*')
    .single()

  if (upsertError) {
    console.error('Failed to upsert user:', upsertError)
    return null
  }

  return newUser
}
