import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { i18n, setLocale } from '@/app/i18n'
import BackgroundTemplateGrid from '@/components/translation/BackgroundTemplateGrid.vue'

const templates = Array.from({ length: 100 }, (_, index) => ({
  id: `template-${index}`,
  name: `Template ${index}`,
  path: `sprite_base/template/template-${index}.png`,
  scope: 'template' as const,
}))

describe('BackgroundTemplateGrid', () => {
  it('virtualizes template cells, selects a template, and uploads image files', async () => {
    setLocale('en')
    const wrapper = mount(BackgroundTemplateGrid, {
      props: { templates, imageUrls: {} },
      global: { plugins: [i18n], stubs: { Slider: true } },
    })

    const cells = wrapper.findAll('[data-testid="background-template-grid-item"]')
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.length).toBeLessThan(templates.length)

    await cells[0]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['template-0']])

    const input = wrapper.get('input[type="file"]')
    const file = new File(['image'], 'template.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')

    expect(wrapper.emitted('upload')).toEqual([[[file]]])
  })
})
