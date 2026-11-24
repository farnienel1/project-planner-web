'use client'

import { useEffect } from 'react'
import { installFeedbackUnlock, playPendingWelcomeSound } from '@/lib/feedbackSounds/feedback'

/**
 * Feedback sounds (docs/design/feedback/feedback-sounds-haptics-guide.md): lets audio start on the person's own
 * click or key press (browser autoplay rules) and loads the seven small files once the browser is idle. The one
 * thing it plays itself is the welcome chord, once, when this tab has just signed in (owner 24 Nov; the sign-in
 * screen marks it, and the mark is cleared here so a reload plays nothing).
 */
export function FeedbackSoundsUnlock() {
  useEffect(() => {
    const stop = installFeedbackUnlock()
    playPendingWelcomeSound()
    return stop
  }, [])
  return null
}
