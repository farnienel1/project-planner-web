import localFont from 'next/font/local'

/** Self-hosted so production builds never fetch Google Fonts (Netlify next/font loader crash). */
export const inter = localFont({
  src: [
    { path: '../fonts/Inter-latin-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/Inter-latin-500.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/Inter-latin-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
})

export const jakarta = localFont({
  src: [
    { path: '../fonts/PlusJakartaSans-latin-500.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/PlusJakartaSans-latin-600.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/PlusJakartaSans-latin-700.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/PlusJakartaSans-latin-800.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-head',
  display: 'swap',
})
