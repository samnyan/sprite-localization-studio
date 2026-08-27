import { describe, expect, it } from 'vitest'

import {
  createBackgroundTemplatePath,
  createSpriteBackgroundPath,
} from '@/application/assets/backgroundPath'

describe('background paths', () => {
  it('keeps shared templates in the shared template directory', () => {
    expect(createBackgroundTemplatePath('button', 'Base.PNG')).toBe(
      'sprite_base/template/id-button.png',
    )
  })

  it('encodes manifest and sprite identifiers into dedicated resource directories', () => {
    expect(createSpriteBackgroundPath('ui/main', 'CON', 'asset', 'clean.webp')).toBe(
      'sprite_base/id-ui%2Fmain/id-CON/id-asset.webp',
    )
  })

  it('uses PNG when an uploaded file has no extension', () => {
    expect(createBackgroundTemplatePath('asset', 'clean-base')).toBe(
      'sprite_base/template/id-asset.png',
    )
  })

  it('does not create Windows-sensitive segments from identifiers or extensions', () => {
    expect(createBackgroundTemplatePath('base.', 'clean.svg')).toBe(
      'sprite_base/template/id-base%2E.png',
    )
  })
})
