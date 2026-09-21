'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { APP_STORE_URL, COMPANY, NAV_LINKS, PLAY_STORE_URL, SUPPORT_EMAIL } from '@/lib/marketing/content'
import { MODULES } from '@/lib/marketing/content'
import { MktIcon } from '@/components/marketing/icons'
import { LogoMark } from '@/components/marketing/LogoMark'
import { Reveal } from '@/components/marketing/Reveal'
import { StoreBadge } from '@/components/marketing/StoreBadge'

const ANNC_KEY = 'pp.annc.android.dismissed'

export function MarketingShell({
  children,
  current,
}: {
  children: React.ReactNode
  current?: string
}) {
  const pathname = usePathname()
  const route = current || pathname || '/'
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [annc, setAnnc] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    try {
      setAnnc(window.localStorage.getItem(ANNC_KEY) !== '1')
    } catch {
      setAnnc(true)
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    let hide: number | undefined
    const onToast = (event: Event) => {
      const message = (event as CustomEvent<string>).detail
      setToast(message)
      window.clearTimeout(hide)
      hide = window.setTimeout(() => setToast(''), 2600)
    }
    window.addEventListener('mkt-toast', onToast)
    return () => {
      window.removeEventListener('mkt-toast', onToast)
      window.clearTimeout(hide)
    }
  }, [])

  function dismissAnnc() {
    setAnnc(false)
    try {
      window.localStorage.setItem(ANNC_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const year = new Date().getFullYear()

  return (
    <div className="mkt">
      <a href="#main" className="btn sm skip-link">
        Skip to content
      </a>
      {annc ? (
        <div className="annc" id="annc">
          <Link href="/download">
            New: Project Planner is now on Android <b>Get the app →</b>
          </Link>
          <button type="button" aria-label="Dismiss" onClick={dismissAnnc}>
            ×
          </button>
        </div>
      ) : null}
      <header className={`nav${scrolled ? ' scrolled' : ''}`} id="nav">
        <div className="wrap">
          <Link href="/" className="logo" aria-label="Project Planner home">
            <LogoMark />
            <span className="lt">Project Planner</span>
          </Link>
          <nav className="links" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={route === link.href || route.startsWith(`${link.href}/`) ? 'on' : ''}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="acts">
            <Link href="/login" className="btn ghost hide-sm">
              Sign in
            </Link>
            <Link href="/setup" className="btn primary">
              Start free trial
            </Link>
            <button
              type="button"
              className="btn round burger"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MktIcon name={menuOpen ? 'x' : 'menu'} size={20} />
            </button>
          </div>
        </div>
      </header>
      <nav className={`mnav${menuOpen ? ' show' : ''}`} id="mnav" aria-label="Mobile">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
            {link.label}
          </Link>
        ))}
        <div className="stack" style={{ marginTop: 18 }}>
          <Link href="/login" className="btn block" onClick={() => setMenuOpen(false)}>
            Sign in
          </Link>
          <Link href="/setup" className="btn primary block" onClick={() => setMenuOpen(false)}>
            Start free trial
          </Link>
        </div>
      </nav>
      <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
        {children}
      </main>
      <footer>
        <div className="wrap">
          <div className="fgrid">
            <div>
              <Link href="/" className="logo">
                <LogoMark />
                Project Planner
              </Link>
              <p className="muted" style={{ marginTop: 14, maxWidth: 320 }}>
                Scheduling, timesheets, materials and H&S for MEP and construction subcontractors. Built by a
                London MEP contractor.
              </p>
              <div className="row" style={{ marginTop: 18 }}>
                <StoreBadge store="ios" height={46} />
                <StoreBadge store="android" height={46} />
              </div>
            </div>
            <div>
              <h4>Product</h4>
              <Link href="/features">All features</Link>
              {MODULES.slice(0, 5).map((mod) => (
                <Link key={mod.id} href={`/features/${mod.id}`}>
                  {mod.name}
                </Link>
              ))}
            </div>
            <div>
              <h4>Pricing</h4>
              <Link href="/pricing">Pricing</Link>
              <Link href="/pricing#compare">Compare plans</Link>
              <Link href="/setup">Start free trial</Link>
              <Link href="/download">Download apps</Link>
            </div>
            <div>
              <h4>Company</h4>
              <Link href="/about">About us</Link>
              <Link href="/support">Support</Link>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </div>
            <div>
              <h4>Legal</h4>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
            </div>
          </div>
          <div className="legal">
            <span>
              © {year} {COMPANY.legalName}. All rights reserved.
            </span>
            <span>
              Registered in {COMPANY.jurisdiction}, company no. {COMPANY.number}
            </span>
            <span>{COMPANY.address}</span>
          </div>
        </div>
      </footer>
      <div className={`mkt-toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
        {toast ? (
          <>
            <i>
              <MktIcon name="check" size={14} />
            </i>
            {toast}
          </>
        ) : null}
      </div>
    </div>
  )
}

export function CtaBand({ ratesLabel = 'See our pricing' }: { ratesLabel?: string }) {
  return (
    <section className="s tight">
      <div className="wrap">
        <Reveal className="cta">
          <h2>Get your whole team booked in by Friday.</h2>
          <p>
            Set up your organisation in about ten minutes. Try every feature free for a month, then pick the plan
            that fits your team.
          </p>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            <Link href="/setup" className="btn white lg">
              <MktIcon name="rocket" size={20} />
              Start free trial
            </Link>
            <Link href="/pricing" className="btn glass lg">
              {ratesLabel}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
