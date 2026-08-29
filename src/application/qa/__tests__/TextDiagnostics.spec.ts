import { describe, expect, it } from 'vitest'

import { collectTextDiagnostics } from '@/application/qa/TextDiagnostics'
import type { ProjectManifest } from '@/domain/project/types'

describe('collectTextDiagnostics', () => {
  it('reports only empty translations with their region location', () => {
    expect(collectTextDiagnostics({ schemaVersion: 3, name: 'Test', translations: [{
      spriteTableId: 'ui', spriteId: 'start', textRegions: [
        { id: 'empty', rect: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, translationKey: 'a' },
        { id: 'done', rect: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, translationKey: 'b', translatedText: 'Done' },
      ],
    }] })).toEqual([{ code: 'missingTranslation', spriteTableId: 'ui', spriteId: 'start', regionId: 'empty' }])
  })

  it('blocks builds only while a text translation is missing', () => {
    const project: ProjectManifest = {
      schemaVersion: 3,
      name: 'Test',
      translations: [{
        spriteTableId: 'ui',
        spriteId: 'start',
        textRegions: [
          { id: 'empty', rect: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, translationKey: 'a' },
        ],
      }],
    }

    expect(collectTextDiagnostics(project)).toHaveLength(1)
    project.translations = [{
      spriteTableId: 'ui',
      spriteId: 'start',
      textRegions: [{
        id: 'empty',
        rect: { x: 0, y: 0, width: 1, height: 1 },
        rotation: 0,
        translationKey: 'a',
        translatedText: 'Done',
      }],
    }]
    expect(collectTextDiagnostics(project)).toHaveLength(0)
  })

  it('does not block absent or empty regions but blocks blank text in a mixed project', () => {
    expect(collectTextDiagnostics({ schemaVersion: 3, name: 'Test' })).toHaveLength(0)
    expect(collectTextDiagnostics({
      schemaVersion: 3,
      name: 'Test',
      translations: [{ spriteTableId: 'ui', spriteId: 'empty', textRegions: [] }],
    })).toHaveLength(0)
    expect(collectTextDiagnostics({
      schemaVersion: 3,
      name: 'Test',
      translations: [{
        spriteTableId: 'ui',
        spriteId: 'mixed',
        textRegions: [
          { id: 'done', rect: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, translationKey: 'a', translatedText: 'Done' },
          { id: 'blank', rect: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, translationKey: 'b', translatedText: '  ' },
        ],
      }],
    })).toHaveLength(1)
  })
})
