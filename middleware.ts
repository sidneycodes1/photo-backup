import { importSPKI, jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'
import { applyCookiesToResponse, refreshSupabaseSession } from '@/lib/supabase/middleware'

const PROTECTED_PATHS = ['/gallery', '/upload', '/settings', '/restore', '/login']
const PROTECTED_API_PATHS = ['/api/storage-stats']

type RateLimitBucket = {
  count: number
  resetAt: number
}

const rateLimitBuckets = new Map<string, RateLimitBucket>()

const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  '/api/storage-stats': {
    limit: 120,
    windowMs: 60_000,
  },
  '/api/supabase-proxy': {
    limit: 30,
    windowMs: 60_000,
  },
}

async function verifyPrivyToken(token: string) {
  const verificationKey = process.env.PRIVY_VERIFICATION_KEY
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!verificationKey || !appId) {
    throw new Error('Missing PRIVY_VERIFICATION_KEY or NEXT_PUBLIC_PRIVY_APP_ID')
  }

  const publicKey = await importSPKI(verificationKey, 'ES256')
  return jwtVerify(token, publicKey, {
    issuer: 'privy.io',
    audience: appId,
  })
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function isProtectedApiPath(pathname: string) {
  return PROTECTED_API_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function getRateLimitKey(request: NextRequest, subject: string | null) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwardedFor || request.headers.get('cf-connecting-ip') || 'unknown'
  return `${subject ?? ip}:${request.nextUrl.pathname}`
}

function applyRateLimit(key: string, pathname: string): { allowed: boolean; retryAfterSeconds: number } {
  const config = RATE_LIMITS[pathname]
  if (!config) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const now = Date.now()
  const bucket = rateLimitBuckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (bucket.count >= config.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  bucket.count += 1
  rateLimitBuckets.set(key, bucket)

  return { allowed: true, retryAfterSeconds: 0 }
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Pass Privy OAuth callbacks through safely
  if (searchParams.has('privy_oauth_code') || searchParams.has('privy_oauth_state') || searchParams.has('privy_oauth_provider')) {
    return NextResponse.next()
  }

  const { cookiesToSet } = await refreshSupabaseSession(request)
  const privyToken = request.cookies.get('privy-token')?.value
  const isProtected = isProtectedPath(pathname)
  const isProtectedApi = isProtectedApiPath(pathname)
  const isSupabaseProxy = pathname === '/api/supabase-proxy'

  // Ignore static assets or simple API routes that aren't protected
  // Also allow public share pages and supabase-proxy (auth handled internally)
  if (pathname.startsWith('/_next') || pathname.startsWith('/share') || pathname === '/api/supabase-proxy' || (pathname.startsWith('/api') && !isProtectedApiPath(pathname)) || pathname === '/favicon.ico' || pathname === '/robots.txt') {
    // Apply rate limiting to unauthenticated supabase-proxy requests
    if (isSupabaseProxy && !privyToken) {
      const rateLimitKey = getRateLimitKey(request, null)
      const rateLimit = applyRateLimit(rateLimitKey, pathname)

      if (!rateLimit.allowed) {
        const response = NextResponse.json(
          {
            success: false,
            error: 'Too many requests',
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.retryAfterSeconds),
            },
          },
        )
        return applyCookiesToResponse(response, cookiesToSet)
      }
    }
    const response = NextResponse.next()
    return applyCookiesToResponse(response, cookiesToSet)
  }

  // Redirect legacy frontend paths to the root single-page app
  if (isProtected) {
    const response = NextResponse.redirect(new URL('/', request.url))
    return applyCookiesToResponse(response, cookiesToSet)
  }

  if (pathname === '/refresh') {
    const response = NextResponse.next()
    return applyCookiesToResponse(response, cookiesToSet)
  }

  // Guard protected API endpoints
  if (isProtectedApi) {
    if (!privyToken) {
      const response = NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      return applyCookiesToResponse(response, cookiesToSet)
    }

    try {
      const verifiedToken = await verifyPrivyToken(privyToken)
      const rateLimitKey = getRateLimitKey(request, verifiedToken.payload.sub ?? null)
      const rateLimit = applyRateLimit(rateLimitKey, pathname)

      if (!rateLimit.allowed) {
        const response = NextResponse.json(
          {
            success: false,
            error: 'Too many requests',
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.retryAfterSeconds),
            },
          },
        )
        return applyCookiesToResponse(response, cookiesToSet)
      }

      const response = NextResponse.next()
      return applyCookiesToResponse(response, cookiesToSet)
    } catch {
      const response = NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      return applyCookiesToResponse(response, cookiesToSet)
    }
  }

  // Apply rate limiting to unauthenticated supabase-proxy requests (get_share_public)
  if (pathname === '/api/supabase-proxy' && !privyToken) {
    const rateLimitKey = getRateLimitKey(request, null)
    const rateLimit = applyRateLimit(rateLimitKey, pathname)

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Too many requests',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        },
      )
      return applyCookiesToResponse(response, cookiesToSet)
    }
  }

  const response = NextResponse.next()
  return applyCookiesToResponse(response, cookiesToSet)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
