/**
 * iOS parity source: Views/ManageUserProfileChrome.swift, HomeProfileCardSheet
 * Displays users.profilePhotoURL from Firebase Storage when iOS (or web) set it.
 */

'use client'

import { useEffect, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import { withTimeout } from '@/lib/client/withTimeout'
import { auth, storage } from '@/lib/firebase/config'
import type { User } from '@/types'

const PHOTO_URL_TIMEOUT_MS = 8_000
const PHOTO_LOAD_MS = 15_000

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
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const resolved = useResolvedPhotoUrl(user.profilePhotoURL)
  const showPhoto = Boolean(resolved) && !failed

  useEffect(() => {
    setFailed(false)
    setLoaded(false)
  }, [user.profilePhotoURL, resolved])

  useEffect(() => {
    if (!resolved || loaded) return
    const timer = window.setTimeout(() => setFailed(true), PHOTO_LOAD_MS)
    return () => window.clearTimeout(timer)
  }, [resolved, loaded])

  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full bg-gradient-to-br ${gradient} ${className}`}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved || ''}
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          onLoad={() => {
            setLoaded(true)
            setFailed(false)
          }}
          onError={() => setFailed(true)}
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
