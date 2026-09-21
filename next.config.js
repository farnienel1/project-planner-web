const path = require('path')

const ContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com https://js.stripe.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com https://maps.gstatic.com https://unpkg.com https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasestorage.app https://*.firebaseapp.com https://*.cloudfunctions.net https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://api.stripe.com https://*.stripe.com https://*.stripe.network https://maps.googleapis.com https://photon.komoot.io https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org https://unpkg.com https://cdnjs.cloudflare.com",
  "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com https://*.firebaseapp.com",
  "worker-src 'self' blob: https://cdnjs.cloudflare.com",
  "media-src 'self' blob:",
]

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy.join('; ') },
]

const deploymentId = process.env.COMMIT_REF || process.env.NEXT_DEPLOYMENT_ID || ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(deploymentId ? { deploymentId } : {}),
  experimental: {
    optimizePackageImports: ['date-fns'],
  },
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'project-planner-f986c.firebasestorage.app' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  async rewrites() {
    // iOS invite emails use /setup-password.html?token=
    return [{ source: '/setup-password.html', destination: '/setup-password' }]
  },
  async redirects() {
    return [
      { source: '/dashboard/skills', destination: '/dashboard', permanent: false },
      { source: '/dashboard/skills/:path*', destination: '/dashboard', permanent: false },
      { source: '/rates', destination: '/pricing', permanent: false },
      { source: '/rates/:path*', destination: '/pricing', permanent: false },
      { source: '/privacy-policy.html', destination: '/privacy', permanent: false },
      { source: '/terms-of-service.html', destination: '/terms', permanent: false },
    ]
  },
}

module.exports = nextConfig
