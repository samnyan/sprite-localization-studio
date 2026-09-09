import { computed, ref } from 'vue'

import { inferFontStyle, inferFontWeight } from '@/domain/font/fontStyle'
import type { SystemFont } from '@/domain/font/types'

const FALLBACK_SYSTEM_FONTS: SystemFont[] = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
].map((family) => ({ family, fullName: family, weight: 400, style: 'normal' }))

function toSystemFont(font: LocalFontData): SystemFont {
  const subfamily = font.style || undefined
  return {
    family: font.family,
    ...(font.fullName ? { fullName: font.fullName } : {}),
    ...(font.postscriptName ? { postscriptName: font.postscriptName } : {}),
    ...(subfamily ? { subfamily } : {}),
    weight: inferFontWeight(subfamily) ?? 400,
    style: inferFontStyle(subfamily),
  }
}

function uniqueFonts(fonts: SystemFont[]): SystemFont[] {
  const seen = new Set<string>()
  return fonts
    .filter((font) => {
      const key = `${font.family}\u0000${font.weight}\u0000${font.style}\u0000${font.postscriptName ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((left, right) =>
      `${left.family}\u0000${left.weight}\u0000${left.style}`.localeCompare(
        `${right.family}\u0000${right.weight}\u0000${right.style}`,
      ),
    )
}

export function useSystemFonts() {
  const fonts = ref<SystemFont[]>([...FALLBACK_SYSTEM_FONTS])
  const status = ref<'idle' | 'loading' | 'ready' | 'unsupported' | 'denied' | 'error'>('idle')
  const error = ref<string>()
  const canQuery = computed(() => typeof window !== 'undefined' && 'queryLocalFonts' in window)

  async function requestFonts(): Promise<void> {
    if (!canQuery.value) {
      status.value = 'unsupported'
      return
    }
    status.value = 'loading'
    error.value = undefined
    try {
      const localFonts = await window.queryLocalFonts()
      fonts.value = uniqueFonts(localFonts.map(toSystemFont))
      status.value = 'ready'
    } catch (cause) {
      status.value =
        cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'denied' : 'error'
      error.value = cause instanceof Error ? cause.message : 'Unable to read system fonts.'
      fonts.value = [...FALLBACK_SYSTEM_FONTS]
    }
  }

  return { fonts, status, error, canQuery, requestFonts }
}
