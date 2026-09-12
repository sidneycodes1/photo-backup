import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!
const JWKS_URL = `https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`
const jwks = createRemoteJWKSet(new URL(JWKS_URL), {
  cacheMaxAge: 600_000,
  timeoutDuration: 10_000,  // 10 seconds instead of default 3
})

export function createPrivyTokenVerifier(getKey: JWTVerifyGetKey) {
  return async function verifyPrivyToken(token: string): Promise<string> {
    // Returns the Privy user ID (the sub claim) if valid, otherwise throws.
    try {
      const { payload } = await jwtVerify(token, getKey, { issuer: 'privy.io' })
      if (!payload.sub) throw new Error('No sub claim in token')
      return payload.sub
    } catch (error) {
      console.error('Privy token verification failed:', error)
      throw error
    }
  }
}

// The route handlers always use Privy's remote JWKS. The factory above exists
// solely so tests can verify the same JWT validation logic against a test JWKS.
export const verifyPrivyToken = createPrivyTokenVerifier(jwks)
