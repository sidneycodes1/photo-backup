import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = {
  name: string
  value: string
  options: Parameters<NextResponse['cookies']['set']>[2]
}

export type SupabaseMiddlewareResult = {
  supabase: SupabaseClient
  cookiesToSet: CookieToSet[]
}

export async function refreshSupabaseSession(request: NextRequest): Promise<SupabaseMiddlewareResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const cookiesToSet: CookieToSet[] = []

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToPersist) {
        cookiesToPersist.forEach((cookie) => {
          cookiesToSet.push(cookie)
        })
      },
    },
  })

  await supabase.auth.getUser()

  return {
    supabase,
    cookiesToSet,
  }
}

export function applyCookiesToResponse(response: NextResponse, cookiesToSet: CookieToSet[]) {
  for (const cookie of cookiesToSet) {
    response.cookies.set(cookie.name, cookie.value, cookie.options)
  }

  return response
}
