const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['date-fns'],
  },
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  async rewrites() {
    // iOS invite emails use /setup-password.html?token=
    return [{ source: '/setup-password.html', destination: '/setup-password' }]
  },
  async redirects() {
    return [
      { source: '/dashboard/skills', destination: '/dashboard', permanent: false },
      { source: '/dashboard/skills/:path*', destination: '/dashboard', permanent: false },
    ]
  },
}

module.exports = nextConfig




