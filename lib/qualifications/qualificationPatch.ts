/**
 * What one qualifications save changes on an existing `operatives` row (owner issue 16, review of #415). The merge is
 * the rulebook's (`mergeOperativeQualificationWrite`, `removedQualificationCertificateIds`); this only turns the
 * merge into the in-memory row and the field-path writes (`qualificationMapWrites`) the store sends.
 */
import type { Operative, Qualification } from '@/types'
import {
  mergeOperativeQualificationWrite,
  removedQualificationCertificateIds,
} from '@/lib/canonical/operativeQualifications'
import { certificateUrlsWithoutReplaced } from '@/lib/qualifications/certificateUpload'
import { qualificationMapWrites, type QualificationMapWrite } from '@/lib/qualifications/personQualifications'

export type OperativeQualificationPatch = {
  qualifications: Qualification[]
  qualificationExpiryDates: Record<string, Date>
  qualificationCertificateURLs: Record<string, string>
  /** Field-path changes of the two maps against `existing` (empty when there is no stored row). */
  mapWrites: QualificationMapWrite[]
}

export function operativeQualificationPatch(existing: Operative | undefined, operative: Operative): OperativeQualificationPatch {
  const nextIds = (operative.qualifications || []).map((row) => String(row.id || '').trim()).filter(Boolean)
  const merged = mergeOperativeQualificationWrite({
    previous: {
      qualifications: existing?.qualifications,
      qualificationExpiryDates: existing?.qualificationExpiryDates,
      // A renewed certificate replaces the stored link under every spelling of its id (the old Storage object is
      // kept, §24).
      qualificationCertificateURLs: certificateUrlsWithoutReplaced(
        existing?.qualificationCertificateURLs,
        operative.qualificationCertificateURLs
      ),
    },
    next: {
      qualifications: operative.qualifications,
      qualificationExpiryDates: operative.qualificationExpiryDates,
      qualificationCertificateURLs: operative.qualificationCertificateURLs,
      removedCertificateIds: removedQualificationCertificateIds(
        existing?.qualificationCertificateURLs,
        operative.qualificationCertificateURLs,
        nextIds
      ),
    },
  })
  const qualificationExpiryDates = Object.fromEntries(
    Object.entries(merged.qualificationExpiryDates).map(([key, iso]) => [key, new Date(iso)])
  )
  const qualificationCertificateURLs = merged.qualificationCertificateURLs
  return {
    qualifications: merged.qualifications.map((row) => ({
      id: row.id,
      name: row.name,
      hasEndDate: row.hasEndDate,
      createdAt: new Date(row.createdAtIso),
      updatedAt: new Date(row.updatedAtIso),
      endDate: row.endDateIso ? new Date(row.endDateIso) : undefined,
    })),
    qualificationExpiryDates,
    qualificationCertificateURLs,
    mapWrites: existing
      ? qualificationMapWrites({
          storedExpiry: existing.qualificationExpiryDates,
          storedUrls: existing.qualificationCertificateURLs,
          mergedExpiry: qualificationExpiryDates,
          mergedUrls: qualificationCertificateURLs,
        })
      : [],
  }
}
