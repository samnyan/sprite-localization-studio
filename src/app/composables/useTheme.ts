import { readonly, ref } from 'vue'

export type ColorTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'sls.theme'

function getInitialTheme(): ColorTheme {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)

  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const theme = ref<ColorTheme>(getInitialTheme())

function applyTheme(value: ColorTheme): void {
  document.documentElement.classList.toggle('dark', value === 'dark')
  document.documentElement.style.colorScheme = value
}

applyTheme(theme.value)

export function useTheme() {
  function setTheme(value: ColorTheme): void {
    theme.value = value
    localStorage.setItem(THEME_STORAGE_KEY, value)
    applyTheme(value)
  }

  function toggleTheme(): void {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    theme: readonly(theme),
    setTheme,
    toggleTheme,
  }
}
