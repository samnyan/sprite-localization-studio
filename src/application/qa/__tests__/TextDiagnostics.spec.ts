import { describe, expect, it } from 'vitest'

import { collectTextDiagnostics } from '@/application/qa/TextDiagnostics'

describe('collectTextDiagnostics', () => {
  it('reports only empty translations with their region location', () => {
    expect(collectTextDiagnostics({ schemaVersion: 3, name: 'Test', translations: [{
      spriteTableId: 'ui', spriteId: 'start', textRegions: [
        { id: 'empty', rect: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, translationKey: 'a' },
        { id: 'done', rect: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, translationKey: 'b', translatedText: 'Done' },
      ],
    }] })).toEqual([{ code: 'missingTranslation', spriteTableId: 'ui', spriteId: 'start', regionId: 'empty' }])
  })
})
