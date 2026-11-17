import { parseOrganizationName, safeExternalUrl } from '@/lib/canonical'
import { clampString } from '@/lib/security/validation'

/**
 * Who a material quote / order email is from (rulebook §16, `materialRequestEmailEnvelope`; mass-assignment audit
 * 17 Nov): the signed-in caller's own users document for their name and phone, their ID-token email for the address,
 * and the stored organisation document for the company and logo. Nothing here ever comes from the request body.
 */
export type MaterialRequestSender = {
  name: string
  email: string
  phone: string
  company: string
  logoURL: string
}

export function materialRequestSender(input: {
  tokenEmail: string | null | undefined
  callerDoc: Record<string, unknown> | null | undefined
  orgDoc: Record<string, unknown> | null | undefined
}): MaterialRequestSender {
  const email = String(input.tokenEmail ?? '').trim().toLowerCase()
  const caller = input.callerDoc ?? {}
  const first = clampString(caller.firstName, 100) ?? ''
  const surname = clampString(caller.surname, 100) ?? ''
  const name = clampString(`${first} ${surname}`.trim(), 120) || email
  const phone = clampString(caller.mobileNumber, 40) || clampString(caller.phone, 40) || ''
  const company = (parseOrganizationName(input.orgDoc ?? undefined) || '').slice(0, 200)
  // https only (review of #391): a stored `javascript:`, `data:` or plain `http:` logo is never put in the email.
  const logoURL = safeExternalUrl(clampString(input.orgDoc?.companyLogoURL, 500) || '') || ''
  return { name, email, phone, company, logoURL }
}
