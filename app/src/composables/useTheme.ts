import { computed, ref, watchEffect } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'nostrhost.theme'

function readStored(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    // localStorage unavailable (private mode, disabled storage) — fall back.
  }
  return 'system'
}

const preference = ref<ThemePreference>(readStored())

const systemPrefersDark =
  typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

const systemIsDark = ref(systemPrefersDark?.matches ?? true)
systemPrefersDark?.addEventListener('change', (event) => {
  systemIsDark.value = event.matches
})

// The resolved light/dark value, whether the preference is explicit or
// follows the OS setting.
const resolved = computed<'light' | 'dark'>(() =>
  preference.value === 'system'
    ? systemIsDark.value
      ? 'dark'
      : 'light'
    : preference.value,
)

watchEffect(() => {
  document.documentElement.setAttribute('data-theme', resolved.value)
})

function setTheme(next: ThemePreference) {
  preference.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Best-effort persistence only.
  }
}

export function useTheme() {
  return { preference, resolved, setTheme }
}
