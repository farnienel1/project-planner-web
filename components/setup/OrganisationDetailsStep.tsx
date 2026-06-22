'use client'

import { useMemo, useRef, useState } from 'react'
import { FormInput, FormLabel, FormSelect } from '@/components/forms/FormShell'
import { LogoCropModal } from '@/components/setup/LogoCropModal'
import {
  SetupCard,
  SetupNote,
  SetupStepHeader,
  SetupStepNav,
} from '@/components/setup/setupFormPrimitives'
import {
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  bankHolidayRegionLabel,
  validateLogoFile,
  type OrganisationIdentitySetup,
} from '@/lib/orgSetup/orgSetupSettings'

type OrganisationDetailsStepProps = {
  organizationName: string
  value: OrganisationIdentitySetup
  onChange: (value: OrganisationIdentitySetup) => void
  onBack: () => void
  onContinue: () => void
}

export function OrganisationDetailsStep({
  organizationName,
  value,
  onChange,
  onBack,
  onContinue,
}: OrganisationDetailsStepProps) {
  const [error, setError] = useState('')
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const logoPreview = useMemo(() => {
    if (!value.logoFile) return value.companyLogoURL ?? null
    return URL.createObjectURL(value.logoFile)
  }, [value.logoFile, value.companyLogoURL])

  function patch(partial: Partial<OrganisationIdentitySetup>) {
    onChange({ ...value, ...partial })
  }

  function patchAddress(partial: Partial<OrganisationIdentitySetup['officeAddress']>) {
    onChange({ ...value, officeAddress: { ...value.officeAddress, ...partial } })
  }

  function handleLogoSelected(file: File | null) {
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) {
      patch({ logoFile: null })
      return
    }
    const validationError = validateLogoFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setPendingLogoFile(file)
  }

  function validate(): string | null {
    if (!value.officeAddress.addressLine1.trim()) return 'Enter your company office address line 1.'
    if (!value.officeAddress.town.trim()) return 'Enter the town or city for your office.'
    if (!value.officeAddress.postcode.trim()) return 'Enter the postcode for your office.'
    if (!value.countryCode) return 'Select your company region.'
    if (!value.currency) return 'Select your currency.'
    return null
  }

  function handleContinue() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    onContinue()
  }

  const displayName = organizationName.trim() || 'your organisation'

  return (
    <div>
      <SetupStepHeader
        eyebrow="Step 1 of guided setup · Organisation details"
        title={`Set up ${displayName}`}
        description="Your office location, region and currency appear on reports, timesheets and the iOS app header. Add your logo now so your team sees the right branding from day one."
      />

      <div className="space-y-6">
        <SetupNote tone="blue">
          These details mirror <strong>Settings → Organisation → Identity</strong>. You can change
          them any time after sign-up — nothing here is permanent.
        </SetupNote>

        <div>
          <SetupStepHeader
            eyebrow="Company office"
            title="Office & region"
            description="Where your company is based. Used for regional defaults such as bank holidays."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormLabel required>Address line 1</FormLabel>
              <FormInput
                value={value.officeAddress.addressLine1}
                onChange={(e) => patchAddress({ addressLine1: e.target.value })}
                placeholder="e.g. Unit 4, Riverside Business Park"
              />
            </div>
            <div className="sm:col-span-2">
              <FormLabel>Address line 2</FormLabel>
              <FormInput
                value={value.officeAddress.addressLine2}
                onChange={(e) => patchAddress({ addressLine2: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <FormLabel required>Town / city</FormLabel>
              <FormInput
                value={value.officeAddress.town}
                onChange={(e) => patchAddress({ town: e.target.value })}
              />
            </div>
            <div>
              <FormLabel>County</FormLabel>
              <FormInput
                value={value.officeAddress.county}
                onChange={(e) => patchAddress({ county: e.target.value })}
              />
            </div>
            <div>
              <FormLabel required>Postcode</FormLabel>
              <FormInput
                value={value.officeAddress.postcode}
                onChange={(e) => patchAddress({ postcode: e.target.value })}
              />
            </div>
            <div>
              <FormLabel required>Region</FormLabel>
              <FormSelect
                value={value.countryCode}
                onChange={(e) => {
                  patch({
                    countryCode: e.target.value,
                    countryLabel: bankHolidayRegionLabel(e.target.value),
                  })
                }}
              >
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </FormSelect>
            </div>
          </div>
        </div>

        <div>
          <SetupStepHeader
            eyebrow="Branding"
            title="Company logo"
            description="JPEG, PNG or PDF up to 10 MB. After upload, crop to a square for the app header and exported documents."
          />
          <SetupCard>
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-slate-300">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                  Upload logo
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/pjpeg,application/pdf,.jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    onChange={(e) => handleLogoSelected(e.target.files?.[0] ?? null)}
                  />
                </label>
                {value.logoFile && (
                  <button
                    type="button"
                    onClick={() => handleLogoSelected(null)}
                    className="block text-sm font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Remove logo
                  </button>
                )}
                <p className="text-xs text-slate-500">
                  Optional — you can add or change this later in Settings. PDF files use the first page for cropping.
                </p>
              </div>
            </div>
          </SetupCard>
        </div>

        <div>
          <SetupStepHeader
            eyebrow="Finance"
            title="Currency"
            description="Used for day rates, timesheets and material pricing across your organisation."
          />
          <FormLabel required>Default currency</FormLabel>
          <FormSelect value={value.currency} onChange={(e) => patch({ currency: e.target.value })}>
            {CURRENCY_OPTIONS.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.label}
              </option>
            ))}
          </FormSelect>
        </div>
      </div>

      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {pendingLogoFile && (
        <LogoCropModal
          file={pendingLogoFile}
          onCancel={() => setPendingLogoFile(null)}
          onConfirm={(croppedFile) => {
            patch({ logoFile: croppedFile })
            setPendingLogoFile(null)
          }}
        />
      )}

      <SetupStepNav onBack={onBack} onNext={handleContinue} nextLabel="Continue to features & functions" />
    </div>
  )
}
