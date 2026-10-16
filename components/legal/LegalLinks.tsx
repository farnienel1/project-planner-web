import Link from 'next/link'
import { PROCESSORS_PATH, PRIVACY_PATH, TERMS_PATH } from '@/lib/legal/processors'

export function LegalLinks({
  includeProcessors = false,
  className,
}: {
  includeProcessors?: boolean
  className?: string
}) {
  return (
    <span className={className}>
      <Link href={PRIVACY_PATH} className="link">
        Privacy Policy
      </Link>
      {' · '}
      <Link href={TERMS_PATH} className="link">
        Terms of Service
      </Link>
      {includeProcessors ? (
        <>
          {' · '}
          <Link href={PROCESSORS_PATH} className="link">
            Processors
          </Link>
        </>
      ) : null}
    </span>
  )
}
