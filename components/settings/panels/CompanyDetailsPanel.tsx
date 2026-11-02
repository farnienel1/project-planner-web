'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { companyLogoPath, uploadFile } from '@/lib/firebase/storageUtils'
import { prepareClientUpload } from '@/lib/security/stripPhotoLocation'
import { coalesceOrganizationName, saveCompanyDetails } from '@/lib/settings/organizationSettings'
import {
  CURRENCY_OPTIONS,
  companyDetailsValidationError,
  defaultCurrencyForCountry,
  normalizeCurrencyCode,
  normalizeDocumentAbbreviation,
  parseCompanyDetails,
  resolveOrganizationCurrency,
} from '@/lib/canonical'
import { geocodeAddress } from '@/lib/maps/geocoding'
import { settingsSaveBarHint } from '@/lib/settings/settingsDirty'
import {
  SettingsFormBody,
  useSettingsBaseline,
  useSettingsDirty,
  useSettingsLeave,
} from '@/components/settings/SettingsDirty'
import { useApplyLiveWhenClean, useLiveOrganizationDetails } from '@/components/settings/useLiveOrganizationSettings'
import {
  COUNTRY_OPTIONS,
  bankHolidayRegionIdFromSelection,
  validateLogoFile,
} from '@/lib/orgSetup/orgSetupSettings'
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
  SaveBar,
} from '@/components/settings/primitives'

type CompanyDraft = {
  name: string
  hasOffice: boolean
  line1: string
  line2: string
  town: string
  county: string
  postcode: string
  country: string
  regionId: string
  abbreviation: string
  currency: string
  logoPreview: string | null
}

/** Company countries (two-letter codes); UK subdivisions stay in the bank-holiday region picker. */
const COMPANY_COUNTRY_OPTIONS = COUNTRY_OPTIONS.filter((option) => /^[A-Z]{2}$/.test(option.code))

/** Saved currency on the document (any of the fields iOS or web write), without the country default. */
function hasSavedCurrency(data: Record<string, unknown> | null): boolean {
  if (!data) return false
  const settings = data.settings && typeof data.settings === 'object' ? (data.settings as Record<string, unknown>) : {}
  return Boolean(
    normalizeCurrencyCode(data.currencyCode) ||
      normalizeCurrencyCode(settings.currencyCode) ||
      normalizeCurrencyCode(data.currency) ||
      normalizeCurrencyCode(data['settings.currencyCode'])
  )
}

export function CompanyDetailsPanel({ onBack }: { onBack: () => void }) {
  const { organization, user } = useAuthStore()
  const requestLeave = useSettingsLeave()

  const [name, setName] = useState('')
  const [hasOffice, setHasOffice] = useState(true)
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [town, setTown] = useState('')
  const [county, setCounty] = useState('')
  const [postcode, setPostcode] = useState('')
  const [country, setCountry] = useState('GB')
  const [regionId, setRegionId] = useState('GB-ENG-WLS')
  const [abbreviation, setAbbreviation] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const { state: loadState, markLoaded, markFailed, isDirty } = useSettingsBaseline<CompanyDraft>()

  const draft: CompanyDraft = {
    name,
    hasOffice,
    line1,
    line2,
    town,
    county,
    postcode,
    country,
    regionId,
    abbreviation,
    currency,
    logoPreview,
  }
  const dirty = loadState.status === 'ready' && (isDirty(draft) || Boolean(logoFile))
  useSettingsDirty(dirty)

  const applyLoaded = useCallback((next: CompanyDraft) => {
    setName(next.name)
    setHasOffice(next.hasOffice)
    setLine1(next.line1)
    setLine2(next.line2)
    setTown(next.town)
    setCounty(next.county)
    setPostcode(next.postcode)
    setCountry(next.country)
    setRegionId(next.regionId)
    setAbbreviation(next.abbreviation)
    setCurrency(next.currency)
    setLogoPreview(next.logoPreview)
    markLoaded(next)
  }, [markLoaded])

  const live = useLiveOrganizationDetails()
  const savedCompany = useMemo(() => (live.data ? parseCompanyDetails(live.data) : null), [live.data])
  const currencySaved = hasSavedCurrency(live.data)
  const fallbackName = organization?.name
  const source = useMemo<CompanyDraft | null>(() => {
    if (!live.data || !savedCompany) return null
    const office = savedCompany.hasOfficeAddress
    return {
      name: coalesceOrganizationName(savedCompany.name, fallbackName),
      hasOffice: office,
      line1: office ? savedCompany.officeAddressLine1 : '',
      line2: office ? savedCompany.officeAddressLine2 : '',
      town: office ? savedCompany.officeCity : '',
      county: office ? savedCompany.officeCounty : '',
      postcode: office ? savedCompany.officePostcode : '',
      country: savedCompany.countryCode,
      regionId: savedCompany.bankHolidayRegionId,
      abbreviation: savedCompany.documentAbbreviation,
      currency: resolveOrganizationCurrency(live.data),
      logoPreview: savedCompany.companyLogoURL || null,
    }
  }, [live.data, savedCompany, fallbackName])
  useApplyLiveWhenClean({ source, status: live.status, dirty, apply: applyLoaded, onFailed: markFailed })

  /** Country drives the time zone and, until a currency is saved, the default currency. */
  function changeCountry(next: string) {
    if (!currencySaved && currency === defaultCurrencyForCountry(country)) {
      setCurrency(defaultCurrencyForCountry(next))
    }
    setCountry(next)
  }

  function onPickLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const validationError = validateLogoFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  /** Map pin for the office (iOS writes defaultLatitude / defaultLongitude). Best effort; untouched on failure. */
  async function officeCoordinate(): Promise<{ latitude: number; longitude: number } | null> {
    if (!hasOffice) return null
    const unchanged =
      savedCompany &&
      savedCompany.defaultLatitude != null &&
      savedCompany.officeAddressLine1 === line1.trim() &&
      savedCompany.officeCity === town.trim() &&
      savedCompany.officePostcode === postcode.trim()
    if (unchanged) return null
    const query = [line1, town, postcode].map((part) => part.trim()).filter(Boolean).join(', ')
    try {
      return await geocodeAddress(query)
    } catch {
      return null
    }
  }

  async function save() {
    if (!organization?.id) return
    const input = {
      name,
      hasOfficeAddress: hasOffice,
      officeAddressLine1: line1,
      officeAddressLine2: line2,
      officeCity: town,
      officeCounty: county,
      officePostcode: postcode,
      countryCode: country,
      documentAbbreviation: abbreviation,
      bankHolidayRegionId: bankHolidayRegionIdFromSelection(regionId),
    }
    const validationError = companyDetailsValidationError(input)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')
    try {
      // A new file uploads first; a cleared logo is deleted; otherwise the saved logo is left alone.
      let companyLogoURL: string | null | undefined = logoPreview ? undefined : null
      if (logoFile) {
        const fileError = validateLogoFile(logoFile)
        if (fileError) {
          setError(fileError)
          return
        }
        const prepared = await prepareClientUpload(logoFile, 'logo')
        if (prepared.error) {
          setError(prepared.error)
          return
        }
        const path = companyLogoPath(organization.id, prepared.file.name)
        companyLogoURL = await uploadFile(path, prepared.file, prepared.file.type || 'image/png')
      }
      const point = await officeCoordinate()

      await saveCompanyDetails(
        organization.id,
        {
          ...input,
          companyLogoURL,
          defaultLatitude: point?.latitude ?? null,
          defaultLongitude: point?.longitude ?? null,
        },
        currency,
        user?.id
      )

      const trimmedName = name.trim()
      useAuthStore.setState((state) => ({
        organization: state.organization
          ? {
              ...state.organization,
              name: trimmedName || state.organization.name,
              companyLogoURL:
                companyLogoURL === undefined ? state.organization.companyLogoURL : companyLogoURL ?? undefined,
            }
          : state.organization,
      }))

      setLogoFile(null)
      // The form shows what was written, so Save goes grey; the live listener then confirms it.
      applyLoaded({
        ...draft,
        name: trimmedName || draft.name,
        abbreviation: normalizeDocumentAbbreviation(abbreviation),
        logoPreview: typeof companyLogoURL === 'string' ? companyLogoURL : companyLogoURL === null ? null : draft.logoPreview,
      })
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
      <PanelHeader title="Company details" onBack={() => requestLeave(onBack)} />

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

      <SettingsFormBody state={loadState}>
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

          <FormField label="Country" hint="Sets the business time zone and the default currency">
            <Select value={country} onChange={(e) => changeCountry(e.target.value)}>
              {COMPANY_COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Bank holiday region">
            <Select value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              <option value="GB-ENG-WLS">England & Wales</option>
              {COUNTRY_OPTIONS.filter((option) => option.code !== 'GB-ENG').map((option) => (
                <option key={option.code} value={option.code}>
                  {bankHolidayRegionLabel(option.code)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Document abbreviation" hint="1–3 characters, shown on iPhone documents">
            <Input
              value={abbreviation}
              maxLength={3}
              onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
              placeholder="e.g. RM"
            />
          </FormField>

          <FormField label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} — {option.title} ({option.symbol})
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
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/pjpeg,image/webp,application/pdf,.jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={onPickLogo}
            />
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
                  if (logoFile) {
                    // Drop the picked file and show the saved logo again.
                    setLogoFile(null)
                    setLogoPreview(savedCompany?.companyLogoURL || null)
                    return
                  }
                  // Save then deletes companyLogoURL (both apps show no logo).
                  setLogoPreview(null)
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                {logoFile ? 'Clear selection' : 'Remove logo'}
              </button>
            )}
          </div>
        </div>
        <p className="px-4 pb-4 text-xs text-slate-500">
          JPEG, PNG or PDF up to 5 MB. Shown on Home and the Site Audit report header.
        </p>
      </SettingsCard>

      </SettingsFormBody>

      <SaveBar dirty={dirty} hint={settingsSaveBarHint(loadState)}>
        <SaveButton saving={saving} saved={saved} dirty={dirty} onClick={save} />
      </SaveBar>
    </div>
  )
}
