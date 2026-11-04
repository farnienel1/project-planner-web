/**
 * iOS parity source: Views/ProfilePhotoAvatar.swift, HomeProfileCardSheet
 * Displays users.profilePhotoURL from Firebase Storage when iOS (or web) set it (RULEBOOK §12).
 *
 * Display only. A failed load is never final: see `lib/users/avatarPhoto.ts`. The attempt is keyed
 * by the URL, `profilePhotoUpdatedAt` and the retry round; a 403 from an older download token asks
 * Storage for the current URL of the same path; a failure retries after a delay, when the browser is
 * back online, or when the tab is shown again.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import { withTimeout } from '@/lib/client/withTimeout'
import { auth, storage } from '@/lib/firebase/config'
import {
  avatarAttemptKey,
  avatarRefreshPath,
  avatarRetryDelayMs,
  storagePathFromDownloadUrl,
  storagePathFromPhotoUrl,
} from '@/lib/users/avatarPhoto'
import type { User } from '@/types'

export { storagePathFromDownloadUrl, storagePathFromPhotoUrl }

const PHOTO_URL_TIMEOUT_MS = 8_000

function initialsOf(user: Pick<User, 'firstName' | 'surname' | 'email'>): string {
  const initials = `${user.firstName?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase()
  return initials.trim() || (user.email || '').slice(0, 2).toUpperCase()
}

async function downloadPhotoUrl(path: string): Promise<string | null> {
  if (!storage) return null
  try {
    const user = auth?.currentUser
    if (user) {
      await withTimeout(user.getIdToken(), PHOTO_URL_TIMEOUT_MS, 'photo-token').catch(() => undefined)
    }
    return await withTimeout(getDownloadURL(ref(storage, path)), PHOTO_URL_TIMEOUT_MS, 'photo-url')
  } catch {
    return null
  }
}

/** The URL to load for one attempt: a download URL as stored, or a stored path resolved through Storage. */
function useResolvedPhotoUrl(stored: string, attemptKey: string): { key: string; src: string | null } {
  const direct = stored && !storagePathFromPhotoUrl(stored) ? stored : null
  const [resolved, setResolved] = useState<{ key: string; src: string | null } | null>(null)

  useEffect(() => {
    if (!stored || direct) return
    const path = storagePathFromPhotoUrl(stored)
    if (!path) return
    let cancelled = false
    void downloadPhotoUrl(path).then((next) => {
      if (!cancelled) setResolved({ key: attemptKey, src: next })
    })
    return () => {
      cancelled = true
    }
  }, [stored, direct, attemptKey])

  if (!stored) return { key: attemptKey, src: null }
  if (direct) return { key: attemptKey, src: direct }
  // A stored path still resolving reads as "no src yet" for this attempt, not as a failure.
  return resolved && resolved.key === attemptKey ? resolved : { key: '', src: null }
}

type PhotoState = { key: string; src: string; state: 'loading' | 'loaded' | 'failed'; refreshed: boolean }
type RetryState = { base: string; round: number; failures: number }

export function UserAvatar({
  user,
  size = 40,
  className = '',
  gradient = 'from-[#185FA5] to-[#378ADD]',
}: {
  user: Pick<User, 'firstName' | 'surname' | 'email' | 'profilePhotoURL'> & {
    profilePhotoUpdatedAt?: Date | null
  }
  size?: number
  className?: string
  gradient?: string
}) {
  const stored = user.profilePhotoURL?.trim() || ''
  const stamp = user.profilePhotoUpdatedAt ?? null
  // A new URL or a new upload time starts again from round 0 with no failures remembered.
  const base = avatarAttemptKey(stored, stamp, 0)
  const [retry, setRetry] = useState<RetryState>({ base, round: 0, failures: 0 })
  const current = retry.base === base ? retry : { base, round: 0, failures: 0 }
  const attemptKey = avatarAttemptKey(stored, stamp, current.round)

  const resolved = useResolvedPhotoUrl(stored, attemptKey)
  // The current download URL Storage gave after a 403, kept for later rounds of the same photo.
  const [fresh, setFresh] = useState<{ base: string; src: string } | null>(null)
  const startSrc = fresh && fresh.base === base ? fresh.src : resolved.key === attemptKey ? resolved.src : null

  const [photo, setPhoto] = useState<PhotoState | null>(null)
  const attempt = photo && photo.key === attemptKey ? photo : null
  const src = attempt ? attempt.src : startSrc
  const resolveFailed = Boolean(stored) && resolved.key === attemptKey && resolved.src === null && !fresh
  const failed = attempt?.state === 'failed' || resolveFailed
  const showPhoto = Boolean(src) && !failed
  const imgRef = useRef<HTMLImageElement | null>(null)

  const nextRound = useCallback(() => {
    setRetry((prev) => {
      const now = prev.base === base ? prev : { base, round: 0, failures: 0 }
      return { base, round: now.round + 1, failures: now.failures }
    })
  }, [base])

  const markFailed = useCallback(
    (key: string, failedSrc: string, refreshed: boolean) => {
      setPhoto({ key, src: failedSrc, state: 'failed', refreshed })
      setRetry((prev) => {
        const now = prev.base === base ? prev : { base, round: 0, failures: 0 }
        return { ...now, failures: now.failures + 1 }
      })
    },
    [base]
  )

  // A path that Storage could not resolve counts as one failed round.
  useEffect(() => {
    if (resolveFailed) {
      setRetry((prev) => {
        const now = prev.base === base ? prev : { base, round: 0, failures: 0 }
        return now.round === current.round && now.failures <= now.round ? { ...now, failures: now.round + 1 } : now
      })
    }
  }, [resolveFailed, base, current.round])

  // Retry a failed load after a delay, and whenever the browser is back online or the tab is shown.
  useEffect(() => {
    if (!failed || !stored) return
    const delay = avatarRetryDelayMs(current.failures)
    const timer = delay == null ? null : window.setTimeout(nextRound, delay)
    const onOnline = () => nextRound()
    const onVisible = () => {
      if (document.visibilityState === 'visible') nextRound()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (timer != null) window.clearTimeout(timer)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [failed, stored, current.failures, nextRound])

  useEffect(() => {
    // A cached image may have finished before React attached onLoad.
    const img = imgRef.current
    if (!src || !img || !img.complete || img.naturalWidth <= 0) return
    setPhoto((prev) =>
      prev?.key === attemptKey && prev.src === src && prev.state === 'loaded'
        ? prev
        : { key: attemptKey, src, state: 'loaded', refreshed: prev?.key === attemptKey ? prev.refreshed : false }
    )
  }, [src, attemptKey])

  const onError = () => {
    if (!src) return
    const key = attemptKey
    if (attempt?.refreshed) {
      markFailed(key, src, true)
      return
    }
    // First failure of this attempt: ask Storage for the current download URL (a re-upload to the
    // fixed path issues a new token, so the older URL answers 403).
    setPhoto({ key, src, state: 'loading', refreshed: true })
    const path = avatarRefreshPath(src, stored)
    if (!path) {
      markFailed(key, src, true)
      return
    }
    void downloadPhotoUrl(path).then((next) => {
      if (next && next !== src) {
        setFresh({ base, src: next })
        setPhoto({ key, src: next, state: 'loading', refreshed: true })
      } else {
        markFailed(key, src, true)
      }
    })
  }

  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full bg-gradient-to-br ${gradient} ${className}`}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${attemptKey}|${src || ''}`}
          ref={imgRef}
          src={src || ''}
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          onLoad={() => {
            if (src) setPhoto({ key: attemptKey, src, state: 'loaded', refreshed: attempt?.refreshed ?? false })
          }}
          onError={onError}
        />
      ) : (
        <span
          className="grid h-full w-full place-items-center font-semibold text-white"
          style={{ fontSize: Math.max(10, Math.round(size * 0.32)) }}
        >
          {initialsOf(user)}
        </span>
      )}
    </span>
  )
}
