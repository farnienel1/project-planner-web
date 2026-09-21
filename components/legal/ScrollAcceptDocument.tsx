'use client'

import { useEffect, useRef, useState, type ReactNode, type UIEvent } from 'react'
import { isScrolledToBottom } from '@/lib/legal/scrollUtils'
import type { LegalDocument } from '@/lib/legal/customerLegalPack'

export function LegalDocumentBody({ document }: { document: LegalDocument }) {
  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-slate-800">
      <p>{document.intro}</p>
      {document.sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h3 className="text-[15px] font-semibold text-slate-900">{section.title}</h3>
          {section.paragraphs.map((paragraph, index) => (
            <p key={`${section.title}-${index}`}>{paragraph}</p>
          ))}
          {section.bullets ? (
            <ul className="list-disc space-y-1 pl-5">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  )
}

export function ScrollAcceptDocument({
  document,
  accepted,
  onAccept,
}: {
  document: LegalDocument
  accepted: boolean
  onAccept: () => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [read, setRead] = useState(false)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    if (isScrolledToBottom(el)) setRead(true)
  }, [document.id])

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    if (isScrolledToBottom(event.currentTarget)) setRead(true)
  }

  const canAccept = read && !accepted
  const label = accepted ? 'Accepted' : document.acceptLabel

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{document.title}</h2>
        <p className="text-xs text-slate-500">Scroll through the full document to enable the button.</p>
      </div>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="h-[280px] overflow-y-auto card p-4 shadow-inner"
      >
        <LegalDocumentBody document={document} />
      </div>
      <AcceptButton enabled={canAccept} accepted={accepted} onClick={onAccept}>
        {label}
      </AcceptButton>
    </div>
  )
}

export function AcceptButton({
  enabled,
  accepted,
  onClick,
  children,
}: {
  enabled: boolean
  accepted?: boolean
  onClick: () => void
  children: ReactNode
}) {
  const clickable = enabled && !accepted
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
        accepted
          ? 'bg-emerald-600 text-white'
          : clickable
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'cursor-not-allowed bg-slate-300 text-slate-500'
      }`}
    >
      {children}
    </button>
  )
}
