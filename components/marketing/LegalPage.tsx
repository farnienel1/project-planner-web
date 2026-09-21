'use client'

import { SUPPORT_EMAIL } from '@/lib/marketing/content'
import { LEGAL_ENTITY, type LegalDocument } from '@/lib/legal/customerLegalPack'
import { MktIcon } from '@/components/marketing/icons'

export function LegalPage({ document: legal, heading }: { document: LegalDocument; heading: string }) {
  const sections = legal.sections

  return (
    <div className="page">
      <div className="phero">
        <div className="wrap">
          <span className="eyebrow" data-hue="lib">
            <i>
              <MktIcon name="file" size={13} />
            </i>
            Legal
          </span>
          <h1>{heading}</h1>
          <p>
            {LEGAL_ENTITY.name} · company no. 17237456 · Version {LEGAL_ENTITY.version} · Effective {LEGAL_ENTITY.effectiveDate}
          </p>
        </div>
      </div>
      <section className="s" style={{ paddingTop: 20 }}>
        <div className="wrap legalwrap">
          <nav className="card toc" aria-label="Contents">
            <div className="muted small" style={{ fontWeight: 800, padding: '6px 10px' }}>
              Contents
            </div>
            {sections.map((section, index) => (
              <a
                key={section.title}
                href={`#lg${index}`}
                onClick={(event) => {
                  event.preventDefault()
                  window.document.getElementById(`lg${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                {section.title}
              </a>
            ))}
            <div style={{ padding: 10 }}>
              <button type="button" className="btn sm block" onClick={() => window.print()}>
                <MktIcon name="print" size={16} />
                Print
              </button>
            </div>
          </nav>
          <article className="card pad prose" style={{ padding: 40 }}>
            <p>{legal.intro}</p>
            {sections.map((section, index) => (
              <section key={section.title}>
                <h2 id={`lg${index}`}>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
            <p className="muted small" style={{ marginTop: 28 }}>
              Questions about this policy: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
          </article>
        </div>
      </section>
    </div>
  )
}
