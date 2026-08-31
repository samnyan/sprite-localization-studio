import { describe, expect, it } from 'vitest'

import { collectTextFontDiagnostics } from '@/application/qa/TextFontDiagnostics'
import type { ProjectManifest } from '@/domain/project/types'

const project: ProjectManifest = {
  schemaVersion: 3,
  name: 'Test',
  translations: [{
    spriteTableId: 'ui',
    spriteId: 'start',
    textRegions: [{
      id: 'title',
      rect: { x: 0, y: 0, width: 100, height: 24 },
      rotation: 0,
      translationKey: 'title',
      translatedText: 'Start',
      render: {
        fontFamily: 'Demo',
        fontId: 'missing-main',
        fontSize: 16,
        fontWeight: 400,
        color: '#fff',
        align: 'left',
        layers: [
          {
            id: 'enabled',
            enabled: true,
            render: {
              fontFamily: 'Demo',
              fontId: 'missing-layer',
              fontSize: 16,
              fontWeight: 400,
              color: '#fff',
              align: 'left',
            },
          },
          {
            id: 'disabled',
            enabled: false,
            render: {
              fontFamily: 'Demo',
              fontId: 'disabled-font',
              fontSize: 16,
              fontWeight: 400,
              color: '#fff',
              align: 'left',
            },
          },
        ],
      },
    }],
  }],
}

describe('collectTextFontDiagnostics', () => {
  it('reports each unavailable explicit project font for translated enabled layers', () => {
    expect(collectTextFontDiagnostics(project, new Set(['registered-font']))).toEqual([
      {
        code: 'missingProjectFont',
        spriteTableId: 'ui',
        spriteId: 'start',
        regionId: 'title',
        fontId: 'missing-main',
      },
      {
        code: 'missingProjectFont',
        spriteTableId: 'ui',
        spriteId: 'start',
        regionId: 'title',
        fontId: 'missing-layer',
      },
    ])
  })

  it('does not report manual families, registered fonts, or empty translations', () => {
    const available: ProjectManifest = {
      ...project,
      translations: [{
        ...project.translations![0]!,
        textRegions: [
          {
            ...project.translations![0]!.textRegions[0]!,
            render: {
              fontFamily: 'Manual Font',
              fontSize: 16,
              fontWeight: 400,
              color: '#fff',
              align: 'left',
            },
          },
          {
            ...project.translations![0]!.textRegions[0]!,
            id: 'registered',
            render: {
              fontFamily: 'Demo',
              fontId: 'registered-font',
              fontSize: 16,
              fontWeight: 400,
              color: '#fff',
              align: 'left',
            },
          },
          {
            ...project.translations![0]!.textRegions[0]!,
            id: 'empty',
            translatedText: '',
          },
        ],
      }],
    }

    expect(collectTextFontDiagnostics(available, new Set(['registered-font']))).toEqual([])
  })
})
