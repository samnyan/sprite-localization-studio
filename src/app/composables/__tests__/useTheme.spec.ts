import { describe, expect, it } from 'vitest'

import { useTheme } from '@/app/composables/useTheme'

describe('useTheme', () => {
  it('applies and persists the selected theme', () => {
    const { setTheme } = useTheme()

    setTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('sls.theme')).toBe('dark')

    setTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('sls.theme')).toBe('light')
  })
})
