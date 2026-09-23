/** Mask an email for owner-console display: `j•••@company.co.uk`. */
export function maskEmail(email?: string | null): string {
  const value = (email || '').trim()
  if (!value) return ''
  const at = value.lastIndexOf('@')
  if (at <= 0 || at === value.length - 1) return '••••'
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  const first = local.charAt(0)
  return `${first}•••@${domain}`
}

export function emailsMatchIgnoreMask(full: string, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const email = full.trim().toLowerCase()
  return email.includes(needle) || maskEmail(email).toLowerCase().includes(needle)
}
