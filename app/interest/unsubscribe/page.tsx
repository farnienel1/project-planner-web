import type { Metadata } from 'next'
import Link from 'next/link'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { LEGAL_ENTITY } from '@/lib/legal/customerLegalPack'
import { InterestAdminUnavailable } from '@/lib/interest/adminStore'
import { applyInterestUnsubscribe } from '@/lib/interest/unsubscribe'
import { verifyInterestUnsubscribeToken } from '@/lib/interest/unsubscribeToken'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Unsubscribe — Project Planner',
  robots: { index: false, follow: false },
}

type PageState = 'invalid' | 'done' | 'failed'

async function unsubscribeState(token?: string): Promise<PageState> {
  const claims = verifyInterestUnsubscribeToken(token)
  if (!claims) return 'invalid'
  try {
    await applyInterestUnsubscribe(claims)
    return 'done'
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) return 'failed'
    console.error('[interest] unsubscribe page failed', error)
    return 'failed'
  }
}

const COPY: Record<PageState, { title: string; body: string }> = {
  invalid: {
    title: 'That unsubscribe link is not valid.',
    body: 'This link is missing or has been altered. If you still want off the list, write to us and we will take you off.',
  },
  done: {
    title: "You're off the Project Planner list.",
    body: 'We will not send you launch updates at this address. Account and support mail is separate and is not affected.',
  },
  failed: {
    title: 'We could not complete that just now.',
    body: 'Write to us and we will take you off the list.',
  },
}

export default async function InterestUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }> | { token?: string }
}) {
  const params = await searchParams
  const state = await unsubscribeState(typeof params.token === 'string' ? params.token : undefined)
  const copy = COPY[state]

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-[720px] items-center gap-3 px-4 py-3 sm:px-6">
          <AppLogoMark size={36} radius={10} />
          <b className="font-[family-name:var(--head)] text-[17px]">Project Planner</b>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-4 py-14 sm:px-6">
        <h1 className="font-[family-name:var(--head)] text-[clamp(28px,4vw,40px)] font-extrabold leading-tight tracking-tight">
          {copy.title}
        </h1>
        <p className="mt-4 max-w-[52ch] text-lg text-[var(--ink2)]">{copy.body}</p>
        <p className="mt-6 text-[15px] text-[var(--ink2)]">
          <a className="font-semibold text-[var(--blue)]" href={`mailto:${LEGAL_ENTITY.privacyEmail}`}>
            {LEGAL_ENTITY.privacyEmail}
          </a>
        </p>
      </main>
      <footer className="border-t border-[var(--line)] px-4 py-7 text-[13.5px] text-[var(--ink3)] sm:px-6">
        <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-3">
          <span>
            {LEGAL_ENTITY.name} · {LEGAL_ENTITY.registeredOffice}
          </span>
          <span className="flex-1" />
          <Link href="/privacy" className="text-[var(--ink2)]">
            Privacy
          </Link>
          <Link href="/register-interest" className="text-[var(--ink2)]">
            Register interest
          </Link>
        </div>
      </footer>
    </div>
  )
}
