import { redirect } from 'next/navigation'

/** Catalogue manager edit is not part of the iOS Managers flow. */
export default function EditManagerCatalogueRedirectPage() {
  redirect('/dashboard/managers')
}
