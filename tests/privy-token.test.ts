// @vitest-environment node
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { describe, expect, test, vi } from 'vitest'
import { createPrivyTokenVerifier } from '@/lib/auth/verifyPrivyToken'

function tamperJwtPayload(token: string): string {
  const [header, payload, signature] = token.split('.')
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>
  claims.email = 'tampered@vaultly.invalid'
  return `${header}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`
}

describe('Privy JWT verification', () => {
  test('accepts a valid Privy-shaped JWT and rejects a tampered token', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256')
    const publicJwk = await exportJWK(publicKey)
    publicJwk.kid = 'vaultly-test-key'
    publicJwk.use = 'sig'
    publicJwk.alg = 'RS256'

    const verify = createPrivyTokenVerifier(createLocalJWKSet({ keys: [publicJwk] }))
    const token = await new SignJWT({ email: 'test@vaultly.invalid' })
      .setProtectedHeader({ alg: 'RS256', kid: 'vaultly-test-key' })
      .setIssuer('privy.io')
      .setSubject('did:privy:test-user')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey)

    await expect(verify(token)).resolves.toBe('did:privy:test-user')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(verify(tamperJwtPayload(token))).rejects.toThrow()
    } finally {
      consoleError.mockRestore()
    }
  })
})
