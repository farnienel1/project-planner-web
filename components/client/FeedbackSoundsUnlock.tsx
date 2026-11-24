'use client'

import { useEffect } from 'react'
import { installFeedbackUnlock } from '@/lib/feedbackSounds/feedback'

/**
 * Feedback sounds (docs/design/feedback/feedback-sounds-haptics-guide.md): lets audio start on the person's own
 * click or key press (browser autoplay rules) and loads the seven small files once the browser is idle. Renders
 * nothing and plays nothing itself.
 */
export function FeedbackSoundsUnlock() {
  useEffect(() => installFeedbackUnlock(), [])
  return null
}
