// @vitest-environment node
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { describe, expect, test, vi } from 'vitest'
import { createPrivyTokenVerifier } from '@/lib/auth/verifyPrivyToken'

const TEST_APP_ID = 'vaultly-test-app-id'

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

    const verify = createPrivyTokenVerifier(createLocalJWKSet({ keys: [publicJwk] }), TEST_APP_ID)
    const token = await new SignJWT({ email: 'test@vaultly.invalid' })
      .setProtectedHeader({ alg: 'RS256', kid: 'vaultly-test-key' })
      .setIssuer('privy.io')
      .setAudience(TEST_APP_ID)
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

  test('rejects a token issued for a different audience', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256')
    const publicJwk = await exportJWK(publicKey)
    publicJwk.kid = 'vaultly-test-key-es256'
    publicJwk.use = 'sig'
    publicJwk.alg = 'ES256'

    const verify = createPrivyTokenVerifier(createLocalJWKSet({ keys: [publicJwk] }), TEST_APP_ID)
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'vaultly-test-key-es256' })
      .setIssuer('privy.io')
      .setAudience('some-other-app')
      .setSubject('did:privy:test-user')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey)

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(verify(token)).rejects.toThrow()
    } finally {
      consoleError.mockRestore()
    }
  })
})
