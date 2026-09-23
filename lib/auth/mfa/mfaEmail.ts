import { escapeHtml } from '@/lib/security/htmlEscape'

export function buildMfaEmailHtml(code: string): string {
  const safe = escapeHtml(code)
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px;">
      <p style="font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">Project Planner</p>
      <h1 style="font-size: 24px; margin: 12px 0;">Your verification code</h1>
      <p>Use this code to finish signing in. It expires in 10 minutes.</p>
      <p style="font-size: 32px; font-weight: 800; letter-spacing: 0.18em; margin: 24px 0;">${safe}</p>
      <p style="font-size: 14px; color: #475569;">If you did not try to sign in, you can ignore this email. Your password has not been changed.</p>
    </div>
  `.trim()
}

export function mfaEmailSubject(): string {
  return 'Your Project Planner verification code'
}
