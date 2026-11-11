/**
 * Rulebook 1.39.0 §10 review (11 Nov): the clash marker and its popup never reach the booking row behind them. React
 * bubbles events from a portal (the Modal) through the component tree, so the marker and the modal share one wrapper
 * that stops click, key and pointer events; and the marker is a real button rendered beside the row's own button
 * (My Schedule card) — never inside it. No DOM test runner in this repo: the markup is rendered on the server and the
 * structure is checked in the source.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MyScheduleClashMarkerButton } from '../../components/schedule/MyScheduleClashMarker'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('the marker renders as a real button inside the propagation-stopping wrapper', () => {
  const html = renderToStaticMarkup(
    createElement(MyScheduleClashMarkerButton, {
      marker: { bookingId: 'A', state: 'clash', otherBookingIds: ['B'], canOpenWarnings: false, title: 'Booking clash', message: 'm', actionLabel: null },
    })
  )
  assert.match(html, /^<span[^>]*data-testid="my-schedule-clash-marker-wrapper"[^>]*><button type="button"/)
  assert.doesNotMatch(html, /role="button"/)
  assert.equal(renderToStaticMarkup(createElement(MyScheduleClashMarkerButton, { marker: null })), '')
})

test('one wrapper stops click, key and pointer events for the marker and the Modal together', () => {
  const source = read('../../components/schedule/MyScheduleClashMarker.tsx')
  const wrapper = source.indexOf('data-testid="my-schedule-clash-marker-wrapper"')
  assert.ok(wrapper > 0)
  const tag = source.slice(source.lastIndexOf('<span', wrapper), source.indexOf('>', wrapper))
  for (const handler of ['onClick={stop}', 'onKeyDown={stop}', 'onPointerDown={stop}']) assert.ok(tag.includes(handler), handler)
  const close = source.lastIndexOf('</span>')
  assert.ok(source.indexOf('<Modal') > wrapper && source.indexOf('</Modal>') < close, 'the Modal is inside the wrapper')
})

test('My Schedule card: the marker is beside the row button, not nested in it', () => {
  const source = read('../../components/schedule/ScheduleScreen.tsx')
  const rowButton = source.indexOf('aria-expanded={expanded}')
  const rowButtonEnd = source.indexOf('</button>', rowButton)
  const marker = source.indexOf('<MyScheduleClashMarkerButton', rowButton)
  assert.ok(rowButton > 0 && marker > rowButtonEnd, 'marker after the row button closes')
})
