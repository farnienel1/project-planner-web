import { redirect } from 'next/navigation'

/** Catalogue manager records are not the iOS Managers roster. Open the user profile from the list. */
export default function ManagerCatalogueRedirectPage() {
  redirect('/dashboard/managers')
}
