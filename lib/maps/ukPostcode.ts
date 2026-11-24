/**
 * UK postcode text helpers (display and lookup only; nothing here writes to Firestore).
 *
 * A postcode can reach the database with a look-alike of the letter x — "Sw1× 9Hr" with a multiplication sign, typed
 * through a phone keyboard's autocorrect or text replacement (owner bug 24 Nov). Every reader treats those look-alikes
 * as the letter x, so the job still shows "SW1X 9HR" and the postcode lookup still finds it. Only a person's own save
 * writes the corrected value (`postcodeInputValue` / `formatPostcodeForSave`); stored data is never rewritten on load.
 */

/** Characters that look like the letter x: ×, ✕, ✖, ⨯ and the Cyrillic х / Х. */
const X_LOOKALIKES = /[×✕✖⨯хХ]/g

const UK_POSTCODE =
  /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i

/** A whole postcode and nothing else (spaces taken out first). */
const UK_POSTCODE_WHOLE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/i

/** The text with every look-alike of x read as the letter x (upper case for Х). */
export function postcodeLookalikesToX(value: string): string {
  return value.replace(X_LOOKALIKES, (ch) => (ch === 'Х' ? 'X' : 'x'))
}

export function extractUkPostcode(value: string): string | null {
  const match = postcodeLookalikesToX(value).match(UK_POSTCODE)
  if (!match?.[1]) return null
  return match[1].replace(/\s+/g, ' ').toUpperCase()
}

export function normalizeUkPostcode(value: string): string {
  return postcodeLookalikesToX(value).trim().replace(/\s+/g, ' ').toUpperCase()
}

/** "sw1x9hr" / "Sw1x 9Hr" → "SW1X 9HR" (the inward code is always the last three characters). */
export function formatUkPostcode(value: string): string {
  const compact = postcodeLookalikesToX(value).replace(/\s+/g, '').toUpperCase()
  if (compact.length < 5) return compact
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`
}

/** Whether the text (any case or spacing, look-alikes read as x) is one whole UK postcode. */
export function isUkPostcode(value: string): boolean {
  return UK_POSTCODE_WHOLE.test(postcodeLookalikesToX(value).replace(/\s+/g, ''))
}

/**
 * How a stored postcode field is shown: a UK postcode in upper case with one space ("Sw1× 9Hr" → "SW1X 9HR");
 * anything else (a non-UK postcode) trimmed as stored, with x look-alikes read as x.
 */
export function formatPostcodeForDisplay(value: string | null | undefined): string {
  const text = postcodeLookalikesToX(String(value ?? '')).trim()
  if (!text) return ''
  return isUkPostcode(text) ? formatUkPostcode(text) : text
}

/** What a person's own save writes for the postcode field: the display form. */
export function formatPostcodeForSave(value: string | null | undefined): string {
  return formatPostcodeForDisplay(value)
}

/** The postcode field while typing: look-alikes become x and letters upper case; spaces kept as typed. */
export function postcodeInputValue(value: string): string {
  return postcodeLookalikesToX(value).toUpperCase()
}

/** UK postcodes inside free text (a stored site address), each with x look-alikes allowed in its letter places. */
const UK_POSTCODE_IN_TEXT =
  /(^|[^A-Za-z0-9×✕✖⨯хХ])([A-Za-z×✕✖⨯хХ]{1,2}\d[A-Za-z\d×✕✖⨯хХ]?\s*\d[A-Za-z×✕✖⨯хХ]{2})(?=$|[^A-Za-z0-9×✕✖⨯хХ])/g

/** A stored address with every UK postcode in it shown as "SW1X 9HR". Other text is left as stored. */
export function tidyUkPostcodesInText(text: string): string {
  return text.replace(UK_POSTCODE_IN_TEXT, (_m, before: string, code: string) => `${before}${formatUkPostcode(code)}`)
}
