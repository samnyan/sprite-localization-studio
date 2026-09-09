import type { SystemFont } from '@/domain/font/types'

export type FontStyle = SystemFont['style']

export function inferFontWeight(subfamily?: string): number | undefined {
  const value = (subfamily ?? '').toLowerCase().replace(/[\s-]/g, '')
  if (value.includes('thin')) return 100
  if (value.includes('extralight') || value.includes('ultralight')) return 200
  if (value.includes('light')) return 300
  if (value.includes('medium')) return 500
  if (value.includes('semibold') || value.includes('demibold')) return 600
  if (value.includes('extrabold') || value.includes('ultrabold')) return 800
  if (value.includes('black') || value.includes('heavy')) return 900
  if (value.includes('bold')) return 700
  return value.includes('regular') ? 400 : undefined
}

export function inferFontStyle(subfamily?: string): FontStyle {
  const value = (subfamily ?? '').toLowerCase()
  return value.includes('oblique') ? 'oblique' : value.includes('italic') ? 'italic' : 'normal'
}
