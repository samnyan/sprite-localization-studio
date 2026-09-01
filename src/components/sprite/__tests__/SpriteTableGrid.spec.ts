import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { i18n, setLocale } from '@/app/i18n'
import SpriteTableGrid from '@/components/sprite/SpriteTableGrid.vue'

const sprites = Array.from({ length: 100 }, (_, index) => ({
  id: `sprite-${index}`,
  name: `Sprite ${index}`,
  textureId: 'atlas',
  frame: { x: index, y: 0, width: 16, height: 16 },
  rotation: 0 as const,
  trimmed: false,
}))

describe('SpriteTableGrid', () => {
  it('virtualizes Sprite cells and emits distinct select and open actions', async () => {
    setLocale('en')
    const wrapper = mount(SpriteTableGrid, {
      props: {
        spriteTable: {
          schemaVersion: 1,
          id: 'ui',
          name: 'UI',
          textures: [{ id: 'atlas', imagePath: 'ui.png', size: { width: 100, height: 100 } }],
          sprites,
        },
        textureUrls: {},
      },
      global: { plugins: [i18n], stubs: { Slider: true } },
    })

    const cells = wrapper.findAll('[data-testid="sprite-grid-item"]')
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.length).toBeLessThan(sprites.length)

    await cells[0]!.trigger('click')
    await cells[0]!.trigger('dblclick')

    expect(wrapper.emitted('select')).toEqual([['sprite-0']])
    expect(wrapper.emitted('open')).toEqual([['sprite-0']])
  })
})
