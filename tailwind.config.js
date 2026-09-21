/**
 * iOS parity source: Views/ProjectSmallWorksRevampTokens.swift, Blueprint §3.2 / §4.1
 * Spec: docs/ios-parity/03-design-system.md
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['selector', ':is(.dark, [data-theme="dark"])'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E6F1FB',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#378ADD',
          600: '#185FA5',
          700: '#154e88',
          800: '#1e40af',
          900: '#0B1020',
        },
        ios: {
          canvas: 'var(--ios-canvas)',
          card: 'var(--ios-card)',
          ink: 'var(--ios-ink)',
          muted: 'var(--ios-muted)',
          border: 'var(--ios-border)',
          'search-border': 'var(--ios-search-border)',
          blue: 'var(--ios-blue)',
          'blue-light': 'var(--ios-blue-light)',
          green: 'var(--ios-green)',
          amber: 'var(--ios-amber)',
          placeholder: 'var(--ios-placeholder)',
          unread: 'var(--red)',
          'chip-blue': 'var(--blue-t)',
          'chip-green': 'var(--green-t)',
          'chip-amber': 'var(--warn-t)',
          'chip-purple': 'var(--daily-t)',
          'chip-rose': 'var(--sched-t)',
          'chip-coral': 'var(--leave-t)',
          'chip-red': 'var(--red-t)',
          'chip-grey': 'var(--lib-t)',
          'icon-blue': 'var(--blue)',
          'icon-green': 'var(--green)',
          'icon-amber': 'var(--warn)',
          'icon-purple': 'var(--daily)',
          'icon-rose': 'var(--sched)',
          'icon-coral': 'var(--leave)',
          'icon-red': 'var(--red)',
          'icon-grey': 'var(--lib)',
        },
      },
      fontFamily: {
        ios: [
          'var(--font-body)',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        head: ['var(--font-head)', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
        body: ['var(--font-body)', 'Inter', 'sans-serif'],
      },
      maxWidth: {
        shell: '1440px',
      },
      boxShadow: {
        'ios-bar': 'var(--sh-pop)',
        'ios-toast': 'var(--sh-pop)',
        pp: 'var(--sh)',
        'pp-hover': 'var(--sh-hover)',
        'pp-pop': 'var(--sh-pop)',
      },
    },
  },
  plugins: [],
}
