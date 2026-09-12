import { NextResponse } from 'next/server'
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      token?: string
    } | null

    if (!body?.token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const privyUserId = await verifyPrivyToken(body.token)
    const supabase = getAdminClient()

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('privy_user_id', privyUserId)
      .maybeSingle()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('backups')
      .select('encrypted_size, original_size')
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to load storage stats' }, { status: 500 })
    }

    const totals = (data ?? []).reduce(
      (acc, row) => ({
        totalFiles: acc.totalFiles + 1,
        totalEncryptedSize: acc.totalEncryptedSize + Number(row.encrypted_size ?? 0),
        totalOriginalSize: acc.totalOriginalSize + Number(row.original_size ?? 0),
      }),
      {
        totalFiles: 0,
        totalEncryptedSize: 0,
        totalOriginalSize: 0,
      },
    )

    return NextResponse.json({
      success: true,
      ...totals,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Storage stats error:', message)
    return NextResponse.json({ error: message }, { status: 401 })
  }
}

