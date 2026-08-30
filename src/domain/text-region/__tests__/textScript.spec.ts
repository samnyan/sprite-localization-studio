import { describe, expect, it } from 'vitest'

import { requiresComplexTextShaping } from '@/domain/text-region/textScript'

describe('text script detection', () => {
  it('allows simple scripts that use direct glyph drawing', () => {
    expect(requiresComplexTextShaping('Localized UI 世界')).toBe(false)
    expect(requiresComplexTextShaping('Καλημέρα Привет 한글')).toBe(false)
  })

  it('sends unverified scripts and shaping features to a shaping engine', () => {
    expect(requiresComplexTextShaping('مرحبا بالعالم')).toBe(true)
    expect(requiresComplexTextShaping('नमस्ते दुनिया')).toBe(true)
    expect(requiresComplexTextShaping('བོད་ཡིག')).toBe(true)
    expect(requiresComplexTextShaping('ᠮᠣᠩᠭᠣᠯ')).toBe(true)
    expect(requiresComplexTextShaping('ᮠᮚ')).toBe(true)
    expect(requiresComplexTextShaping('e\u0301')).toBe(true)
    expect(requiresComplexTextShaping('👨‍👩‍👧‍👦')).toBe(true)
  })
})
