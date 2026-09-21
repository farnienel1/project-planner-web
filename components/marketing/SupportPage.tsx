'use client'

import { useMemo, useState } from 'react'
import { SUPPORT_EMAIL, SUPPORT_FAQ } from '@/lib/marketing/content'
import { FaqList } from '@/components/marketing/FaqList'
import { MktIcon } from '@/components/marketing/icons'
import { mktToast } from '@/components/marketing/toast'

export function SupportPage() {
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('General question')
  const [message, setMessage] = useState('')
  const [emailError, setEmailError] = useState(false)

  const faqs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SUPPORT_FAQ
    return SUPPORT_FAQ.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(q))
  }, [query])

  function sendContact() {
    const bad = !/^\S+@\S+\.\S+$/.test(email)
    setEmailError(bad)
    if (bad) return
    const subject = encodeURIComponent(`Project Planner support: ${topic}`)
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`)
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
    mktToast('Message opened in your email app. We will reply within one working day')
    setName('')
    setEmail('')
    setMessage('')
  }

  return (
    <div className="page">
      <div className="phero">
        <div className="wrap">
          <span className="eyebrow" data-hue="blue">
            <i>
              <MktIcon name="help" size={13} />
            </i>
            Support
          </span>
          <h1>How can we help?</h1>
          <p>Answers to common questions, and a real person when you need one.</p>
          <label style={{ display: 'flex', maxWidth: 620, margin: '28px auto 0', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 18, top: 17, color: 'var(--ink3)' }}>
              <MktIcon name="search" size={20} />
            </span>
            <input
              className="in"
              style={{ height: 56, paddingLeft: 52, border: 0, boxShadow: 'var(--sh)' }}
              placeholder="Search questions…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search questions"
            />
          </label>
        </div>
      </div>
      <section className="s" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
            <div>
              {faqs.length ? (
                <FaqList items={faqs} />
              ) : (
                <p className="muted">No questions match that search. Email us and we&apos;ll help.</p>
              )}
            </div>
            <div className="stack">
              <div className="card pad" data-hue="blue">
                <div className="ico-chip lg" style={{ marginBottom: 14 }}>
                  <MktIcon name="mail" size={26} />
                </div>
                <h3 style={{ fontSize: 22, marginBottom: 6 }}>Email us</h3>
                <p className="ink2" style={{ marginBottom: 16 }}>
                  We reply within one working day.
                </p>
                <a className="btn primary block" href={`mailto:${SUPPORT_EMAIL}`}>
                  <MktIcon name="mail" size={18} />
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <div className="card pad" data-hue="proj">
                <h3 style={{ fontSize: 20, marginBottom: 14 }}>Send a message</h3>
                <div className="form" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="f">
                    <label htmlFor="cN">Name</label>
                    <input className="in" id="cN" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="f">
                    <label htmlFor="cE">Work email</label>
                    <input
                      className={`in${emailError ? ' bad' : ''}`}
                      id="cE"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setEmailError(false)
                      }}
                    />
                    {emailError ? <span className="err">Enter a valid email</span> : null}
                  </div>
                  <div className="f">
                    <label htmlFor="cT">Topic</label>
                    <select className="in" id="cT" value={topic} onChange={(e) => setTopic(e.target.value)}>
                      <option>General question</option>
                      <option>Sales and pricing</option>
                      <option>Technical support</option>
                      <option>Billing</option>
                    </select>
                  </div>
                  <div className="f">
                    <label htmlFor="cM">Message</label>
                    <textarea className="in" id="cM" value={message} onChange={(e) => setMessage(e.target.value)} />
                  </div>
                </div>
                <button type="button" className="btn primary block" style={{ marginTop: 16 }} onClick={sendContact}>
                  <MktIcon name="send" size={18} />
                  Send message
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
