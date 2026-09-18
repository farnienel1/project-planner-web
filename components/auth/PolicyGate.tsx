/**
 * iOS parity source: Views/PolicyAcceptanceView.swift, Views/PrivacyPolicyView.swift
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §1.2
 *
 * Web first-login now uses the customer legal pack (SaaS, DPA, AUP, Privacy).
 */

'use client'

import { LegalPackGate } from '@/components/auth/LegalPackGate'

export function PolicyGate() {
  return <LegalPackGate />
}
