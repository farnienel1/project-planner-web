'use client'

import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'

type RevealProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  as?: 'div' | 'section'
}

export function Reveal({ children, className = '', as: Tag = 'div', ...rest }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      el.classList.add('vis')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('vis')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag ref={ref as never} className={`reveal ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  )
}
