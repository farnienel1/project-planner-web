import { MarketingShell } from '@/components/marketing/MarketingShell'
import { NotFoundPage } from '@/components/marketing/NotFoundPage'
import { EmailActionNotFoundGate } from '@/components/auth/RecoverEmailAction'

export default function NotFound() {
  return (
    <EmailActionNotFoundGate>
      <MarketingShell>
        <NotFoundPage />
      </MarketingShell>
    </EmailActionNotFoundGate>
  )
}
