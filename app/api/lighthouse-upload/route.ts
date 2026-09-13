import { NextRequest, NextResponse } from 'next/server'
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken'

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024 // 500 MB encrypted payload cap

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token = formData.get('token')
    const file = formData.get('file')

    if (typeof token !== 'string' || !token.trim()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 })
    }

    await verifyPrivyToken(token)

    const apiKey = process.env.LIGHTHOUSE_API_KEY
    if (!apiKey) {
      console.error('[lighthouse-upload] LIGHTHOUSE_API_KEY is not configured')
      return NextResponse.json({ error: 'Upload service unavailable' }, { status: 503 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const lighthouse = (await import('@lighthouse-web3/sdk')).default
    const response = await lighthouse.uploadBuffer(buffer, apiKey)

    const cid = response?.data?.Hash
    if (!cid || typeof cid !== 'string') {
      console.error('[lighthouse-upload] Lighthouse returned no CID')
      return NextResponse.json({ error: 'Upload failed' }, { status: 502 })
    }

    return NextResponse.json({ cid })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error('[lighthouse-upload] error:', error)

    if (message.includes('JWT') || message.includes('token') || message.includes('unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
