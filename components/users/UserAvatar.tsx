/**
 * iOS parity source: Views/ManageUserProfileChrome.swift, HomeProfileCardSheet
 * Displays users.profilePhotoURL from Firebase Storage when iOS (or web) set it.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import { withTimeout } from '@/lib/client/withTimeout'
import { auth, storage } from '@/lib/firebase/config'
import type { User } from '@/types'

const PHOTO_URL_TIMEOUT_MS = 8_000

function initialsOf(user: Pick<User, 'firstName' | 'surname' | 'email'>): string {
  const initials = `${user.firstName?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase()
  return initials.trim() || user.email.slice(0, 2).toUpperCase()
}

export function storagePathFromPhotoUrl(url: string): string | null {
  if (url.startsWith('gs://')) return url.replace(/^gs:\/\/[^/]+\//, '')
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return null
  }
  return url.replace(/^\/+/, '')
}

/**
 * The object path inside a Firebase Storage download URL
 * (`https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded path}?alt=media&token=…`).
 * A re-upload to the same path issues a new token, so an older copy of the URL answers 403;
 * the path lets the avatar ask for the current URL once.
 */
export function storagePathFromDownloadUrl(url: string): string | null {
  const match = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?#]+)/.exec(url)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
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

function useResolvedPhotoUrl(url?: string) {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!url?.trim()) return null
    return storagePathFromPhotoUrl(url.trim()) ? null : url.trim()
  })

  useEffect(() => {
    const value = url?.trim()
    if (!value) {
      setResolved(null)
      return
    }
    const path = storagePathFromPhotoUrl(value)
    if (!path) {
      setResolved(value)
      return
    }
    let cancelled = false
    void downloadPhotoUrl(path).then((next) => {
      if (!cancelled) setResolved(next)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  return resolved
}

type PhotoState = { src: string; state: 'loading' | 'loaded' | 'failed'; retried: boolean }

export function UserAvatar({
  user,
  size = 40,
  className = '',
  gradient = 'from-[#185FA5] to-[#378ADD]',
}: {
  user: Pick<User, 'firstName' | 'surname' | 'email' | 'profilePhotoURL'>
  size?: number
  className?: string
  gradient?: string
}) {
  const resolved = useResolvedPhotoUrl(user.profilePhotoURL)
  // State belongs to one URL. A new URL starts fresh without an effect that could clear a
  // load that already fired (a cached image calls onLoad before effects run).
  const [photo, setPhoto] = useState<PhotoState | null>(null)
  const [refreshed, setRefreshed] = useState<{ from: string; to: string } | null>(null)
  const src = resolved && refreshed?.from === resolved ? refreshed.to : resolved
  const current = photo && photo.src === src ? photo : null
  const showPhoto = Boolean(src) && current?.state !== 'failed'
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    // A cached image may have finished before React attached onLoad.
    const img = imgRef.current
    if (!src || !img || !img.complete) return
    if (img.naturalWidth > 0) setPhoto((prev) => (prev?.src === src && prev.state === 'loaded' ? prev : { src, state: 'loaded', retried: prev?.src === src ? prev.retried : false }))
  }, [src])

  const onError = () => {
    if (!src || !resolved) return
    if (current?.retried) {
      setPhoto({ src, state: 'failed', retried: true })
      return
    }
    // Retry once: ask Storage for the current download URL (a re-upload changes the token).
    setPhoto({ src, state: 'loading', retried: true })
    const path = storagePathFromDownloadUrl(src) ?? storagePathFromPhotoUrl(user.profilePhotoURL?.trim() || '')
    if (!path) {
      setPhoto({ src, state: 'failed', retried: true })
      return
    }
    const from = resolved
    void downloadPhotoUrl(path).then((fresh) => {
      if (fresh && fresh !== src) {
        setRefreshed({ from, to: fresh })
        setPhoto({ src: fresh, state: 'loading', retried: true })
      } else {
        setPhoto({ src, state: 'failed', retried: true })
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
          key={src || ''}
          ref={imgRef}
          src={src || ''}
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          onLoad={() => {
            if (src) setPhoto({ src, state: 'loaded', retried: current?.retried ?? false })
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
