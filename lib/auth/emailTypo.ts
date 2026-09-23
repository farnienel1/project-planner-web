const DOUBLED_TLDS = [/\.com\.com$/i, /\.co\.uk\.uk$/i, /\.org\.org$/i, /\.net\.net$/i, /\.uk\.uk$/i]

const DOMAIN_TYPOS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /@gmial\./i, hint: 'gmail' },
  { pattern: /@gmal\./i, hint: 'gmail' },
  { pattern: /@gamil\./i, hint: 'gmail' },
  { pattern: /@hotmial\./i, hint: 'hotmail' },
  { pattern: /@hotmal\./i, hint: 'hotmail' },
  { pattern: /@outlok\./i, hint: 'outlook' },
  { pattern: /@outloo\./i, hint: 'outlook' },
  { pattern: /@yahooo\./i, hint: 'yahoo' },
  { pattern: /@iclod\./i, hint: 'icloud' },
]

export function emailTypoHint(email?: string | null): string | null {
  const value = (email || '').trim()
  if (!value || !value.includes('@')) return null
  if (value.endsWith('.')) return 'trailing dot'
  if (DOUBLED_TLDS.some((pattern) => pattern.test(value))) return 'doubled TLD'
  const domainTypo = DOMAIN_TYPOS.find((row) => row.pattern.test(value))
  if (domainTypo) return `did you mean ${domainTypo.hint}?`
  const at = value.lastIndexOf('@')
  const domain = value.slice(at + 1)
  if (/\.[a-z]{2,}\.[a-z]{2,}$/i.test(domain) && /(\.[a-z]{2,})\1$/i.test(domain)) return 'doubled TLD'
  return null
}
