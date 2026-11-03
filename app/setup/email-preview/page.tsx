import { notFound } from 'next/navigation'
import { EmailPreviewClient } from './EmailPreviewClient'

/** Developer preview of the account emails, with placeholder data. Not served in production. */
export default function EmailPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <EmailPreviewClient />
}
