import { isVerifiedPlatformOwner } from '@/lib/canonical'

/**
 * Review L1: the platform owner (verified token email, `isVerifiedPlatformOwner`) never sees the gate, so they can
 * always correct `platformConfig/app` even if `minimumWebVersion` is set above the deployed build.
 */
export function webUpdateGateShown(required: boolean, signedIn: { email?: unknown; emailVerified?: unknown } | null | undefined): boolean {
  return required && !isVerifiedPlatformOwner(signedIn)
}
