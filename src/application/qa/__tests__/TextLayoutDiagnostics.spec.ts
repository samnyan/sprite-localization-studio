import { describe, expect, it } from 'vitest'

import { collectTextLayoutDiagnostics } from '@/application/qa/TextLayoutDiagnostics'
import type { ProjectManifest } from '@/domain/project/types'

const project: ProjectManifest = {
  schemaVersion: 3,
  name: 'Test',
  translations: [{
    spriteTableId: 'ui',
    spriteId: 'start',
    textRegions: [{
      id: 'title',
      rect: { x: 0, y: 0, width: 20, height: 20 },
      rotation: 0,
      translationKey: 'title',
      translatedText: 'Long title',
      render: { fontFamily: 'sans-serif', fontSize: 12, fontWeight: 700, color: '#fff', align: 'left', overflow: 'clip' },
    }],
  }],
}

describe('collectTextLayoutDiagnostics', () => {
  it('reports clipped overflow using the injected render measurement', () => {
    expect(collectTextLayoutDiagnostics(project, (text, fontSize) => text.length * fontSize)).toEqual([
      { code: 'textOverflow', spriteTableId: 'ui', spriteId: 'start', regionId: 'title' },
    ])
  })

  it('reports AutoFit when the layout reaches its configured minimum', () => {
    const autoFitProject: ProjectManifest = {
      ...project,
      translations: project.translations?.map((translation) => ({
        ...translation,
        textRegions: translation.textRegions.map((region) => ({
          ...region,
          render: { ...region.render!, autoFit: { minFontSize: 8, maxFontSize: 12 } },
        })),
      })),
    }

    expect(collectTextLayoutDiagnostics(autoFitProject, (text, fontSize) => text.length * fontSize))
      .toContainEqual({ code: 'autoFitAtMinimum', spriteTableId: 'ui', spriteId: 'start', regionId: 'title' })
  })
})
