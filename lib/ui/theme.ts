export const THEME_STORAGE_KEY = 'pp-theme'

export type ThemePreference = 'light' | 'dark'

export function resolveBootTheme(stored: string | null, prefersDark: boolean): ThemePreference {
  if (stored === 'light' || stored === 'dark') return stored
  return prefersDark ? 'dark' : 'light'
}

export function themeToggleCopy(isDark: boolean): { label: 'Dark mode' | 'Light mode'; icon: 'moon' | 'sun' } {
  return isDark ? { label: 'Light mode', icon: 'sun' } : { label: 'Dark mode', icon: 'moon' }
}

export function readStoredTheme(): ThemePreference | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch {
    /* ignore */
  }
  return null
}

export function systemTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: ThemePreference) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.toggle('dark', theme === 'dark')
}

export function persistTheme(theme: ThemePreference) {
  applyTheme(theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}})();`
