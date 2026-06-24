'use client'

import { useEffect, useRef, useState } from 'react'
import { updateDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuthStore } from '@/lib/stores/authStore'
import { companyLogoPath, uploadFile } from '@/lib/firebase/storageUtils'
import { loadOrganizationDetails } from '@/lib/settings/organizationSettings'
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS } from '@/lib/orgSetup/orgSetupSettings'
import { bankHolidayRegionLabel } from '@/lib/settings/bankHolidayRegions'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  Toggle,
  Input,
  Select,
  FormField,
  SaveButton,
  SuccessBanner,
  ErrorBanner,
} from '@/components/settings/primitives'

export function CompanyDetailsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()

  const [name, setName] = useState('')
  const [hasOffice, setHasOffice] = useState(true)
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [town, setTown] = useState('')
  const [county, setCounty] = useState('')
  const [postcode, setPostcode] = useState('')
  const [country, setCountry] = useState('GB')
  const [currency, setCurrency] = useState('GBP')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (!details) return
        setName(details.name ?? organization.name ?? '')
        setCountry((details.countryCode ?? 'GB').toUpperCase())
        setCurrency(details.currency ?? 'GBP')
        const address = details.officeAddress
        if (address?.addressLine1 && address?.town) {
          setHasOffice(true)
          setLine1(address.addressLine1)
          setLine2(address.addressLine2 ?? '')
          setTown(address.town)
          setCounty(address.county ?? '')
          setPostcode(address.postcode ?? '')
        } else {
          setHasOffice(false)
        }
        setLogoPreview(details.companyLogoURL ?? organization.companyLogoURL ?? null)
      })
      .catch(() => {})
  }, [organization?.id, organization?.name, organization?.companyLogoURL])

  function onPickLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function canSave(): boolean {
    if (!name.trim() || !country) return false
    if (hasOffice) return !!line1.trim() && !!town.trim()
    return true
  }

  async function save() {
    if (!organization?.id) return
    if (!canSave()) {
      setError(
        hasOffice
          ? 'Name, country, address line 1 and town are required.'
          : 'Organisation name and country are required.'
      )
      return
    }
    setSaving(true)
    setError('')
    try {
      let companyLogoURL: string | undefined
      if (logoFile) {
        const path = companyLogoPath(organization.id, logoFile.name)
        companyLogoURL = await uploadFile(path, logoFile, logoFile.type || 'image/png')
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        countryCode: country,
        currency,
        officeAddress: hasOffice
          ? {
              addressLine1: line1.trim(),
              addressLine2: line2.trim() || null,
              town: town.trim(),
              county: county.trim() || null,
              postcode: postcode.trim() || null,
            }
          : null,
        updatedAt: Timestamp.now(),
      }
      if (companyLogoURL) payload.companyLogoURL = companyLogoURL

      await updateDoc(doc(db, 'organizations', organization.id), payload)

      useAuthStore.setState((state) => ({
        organization: state.organization
          ? {
              ...state.organization,
              name: name.trim(),
              companyLogoURL: companyLogoURL ?? state.organization.companyLogoURL,
            }
          : state.organization,
      }))

      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save company details.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <PanelHeader title="Company details" onBack={onBack} />

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {saved && (
        <div className="mt-4">
          <SuccessBanner message="Company details saved" />
        </div>
      )}

      <SectionLabel label="Company name" />
      <SettingsCard>
        <div className="p-4">
          <FormField label="Organisation name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organisation name" />
          </FormField>
        </div>
      </SettingsCard>

      <SectionLabel label="Office & region" />
      <SettingsCard>
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-900">Organisation has an office address</span>
            <Toggle checked={hasOffice} onChange={setHasOffice} />
          </div>

          <FormField label="Country / bank holiday region">
            <Select value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {bankHolidayRegionLabel(option.code)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          {hasOffice ? (
            <>
              <FormField label="Office address line 1">
                <Input value={line1} onChange={(e) => setLine1(e.target.value)} />
              </FormField>
              <FormField label="Office address line 2" hint="Optional">
                <Input value={line2} onChange={(e) => setLine2(e.target.value)} />
              </FormField>
              <FormField label="Town / city">
                <Input value={town} onChange={(e) => setTown(e.target.value)} />
              </FormField>
              <FormField label="County" hint="Optional">
                <Input value={county} onChange={(e) => setCounty(e.target.value)} />
              </FormField>
              <FormField label="Postcode" hint="Optional">
                <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
              </FormField>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              No office address — the site map centres on your selected country region.
            </p>
          )}
        </div>
      </SettingsCard>

      <SectionLabel label="Company logo" />
      <SettingsCard>
        <div className="flex items-center gap-4 p-4">
          <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-xl bg-slate-100">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Company logo" className="h-full w-full object-contain" />
            ) : (
              <svg className="h-7 w-7 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                />
              </svg>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickLogo} />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Upload logo
            </button>
            {logoPreview && (
              <button
                type="button"
                onClick={() => {
                  setLogoPreview(null)
                  setLogoFile(null)
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Clear selection
              </button>
            )}
          </div>
        </div>
        <p className="px-4 pb-4 text-xs text-slate-500">Shown on Home and the Site Audit report header.</p>
      </SettingsCard>

      <div className="mt-6">
        <SaveButton saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}
