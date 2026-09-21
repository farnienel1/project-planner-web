/**
 * iOS parity source: Views/ManageUserProfileChrome.swift, HomeProfileCardSheet
 * Displays users.profilePhotoURL from Firebase Storage when iOS (or web) set it.
 */

'use client'

import { useEffect, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '@/lib/firebase/config'
import type { User } from '@/types'

function initialsOf(user: Pick<User, 'firstName' | 'surname' | 'email'>): string {
  const initials = `${user.firstName?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase()
  return initials.trim() || user.email.slice(0, 2).toUpperCase()
}

function storagePathFromPhotoUrl(url: string): string | null {
  if (url.startsWith('gs://')) return url.replace(/^gs:\/\/[^/]+\//, '')
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return null
  }
  return url.replace(/^\/+/, '')
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
    if (!storage) return
    let cancelled = false
    getDownloadURL(ref(storage, path))
      .then((next) => {
        if (!cancelled) setResolved(next)
      })
      .catch(() => {
        if (!cancelled) setResolved(null)
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
  const resolved = useResolvedPhotoUrl(user.profilePhotoURL)
  const showPhoto = Boolean(resolved) && !failed

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
