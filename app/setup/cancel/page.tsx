import Link from 'next/link'

export const metadata = {
  title: 'Checkout cancelled | Project Planner',
}

export default function SetupCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-5">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_2px_30px_rgba(15,23,42,0.08)]">
        <h1 className="text-2xl font-extrabold text-slate-900">Payment cancelled</h1>
        <p className="mt-3 text-sm text-slate-600">
          No charge was made. Your account may have been created with a pending subscription — you can return to
          setup and choose a plan again, or sign in if you already completed payment elsewhere.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/setup" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Back to setup
          </Link>
          <Link href="/login" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
