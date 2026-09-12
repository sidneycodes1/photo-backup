import type { NextConfig } from 'next'

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.privy.io https://api.privy.io",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.privy.io https://auth.privy.io https://api.privy.io https://gateway.lighthouse.storage https://upload.lighthouse.storage https://ipfs.io https://cloudflare-ipfs.com https://dweb.link https://explorer-api.walletconnect.com wss://relay.walletconnect.com",
  "frame-src 'self' https://*.privy.io",
  "img-src 'self' data: blob: https://images.unsplash.com https://avatar.vercel.sh https://*.privy.io https://gateway.lighthouse.storage",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatar.vercel.sh' },
      { protocol: 'https', hostname: 'auth.privy.io' },
      { protocol: 'https', hostname: 'gateway.lighthouse.storage' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy',          value: csp },
          { key: 'Referrer-Policy',                  value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options',           value: 'nosniff' },
          { key: 'X-Frame-Options',                  value: 'DENY' },
          { key: 'Permissions-Policy',               value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security',        value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}

export default nextConfig