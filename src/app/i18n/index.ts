import { createI18n } from 'vue-i18n'

import en from './locales/en'
import zhCN from './locales/zh-CN'

export type SupportedLocale = 'en' | 'zh-CN'

const LOCALE_STORAGE_KEY = 'sls.locale'

function getInitialLocale(): SupportedLocale {
  const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY)

  if (savedLocale === 'en' || savedLocale === 'zh-CN') {
    return savedLocale
  }

  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

const initialLocale = getInitialLocale()

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
  },
})

document.documentElement.lang = initialLocale

export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.documentElement.lang = locale
}
