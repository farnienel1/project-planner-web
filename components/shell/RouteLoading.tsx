/**
 * What a dashboard detail route shows while the next page is on its way (Next.js `loading.tsx`).
 *
 * Without a loading boundary a click on a person, a job or a Back button changed nothing on screen until the
 * server answered, so people clicked again. With one, Next.js shows this straight away (and prefetches it for
 * links in view), keeps the app shell, and swaps in the page when it is ready. Display only: no data, no rules.
 */
export function RouteLoading({ variant = 'detail' }: { variant?: 'detail' | 'form' }) {
  const rows = variant === 'form' ? 6 : 4
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="mx-auto w-full max-w-4xl space-y-5">
      <span className="sr-only">Loading…</span>
      <div className="skel h-8 w-24 rounded-full" />
      <div className="flex items-center gap-4">
        <div className="skel h-14 w-14 flex-none rounded-2xl" />
        <div className="flex-1 space-y-2">
          <div className="skel h-6 w-1/2" />
          <div className="skel h-4 w-1/3" />
        </div>
      </div>
      <div className="card pad space-y-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="space-y-2">
            <div className="skel h-3 w-1/4" />
            <div className={variant === 'form' ? 'skel h-10 w-full' : 'skel h-4 w-2/3'} />
          </div>
        ))}
      </div>
    </div>
  )
}
