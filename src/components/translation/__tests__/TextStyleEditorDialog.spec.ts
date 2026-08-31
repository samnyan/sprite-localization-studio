import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

import { i18n, setLocale } from '@/app/i18n'
import TextStyleEditorDialog from '@/components/translation/TextStyleEditorDialog.vue'
import { Select } from '@/components/ui/select'
import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'

let mountedWrapper: VueWrapper | undefined

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function mountEditor() {
  setLocale('en')
  const wrapper = mount(TextStyleEditorDialog, {
    props: {
      open: true,
      text: 'Start',
      render: DEFAULT_TEXT_RENDER,
      fonts: [{
        id: 'project-font',
        path: 'fonts/demo.ttf',
        family: 'Demo',
        weight: 700,
        style: 'italic',
      }],
    },
    global: {
      plugins: [i18n],
      stubs: {
        Dialog: { template: '<div><slot /></div>' },
        DialogContent: { template: '<div><slot /></div>' },
        DialogFooter: { template: '<div><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        TextStyleCanvasPreview: true,
      },
    },
  })
  mountedWrapper = wrapper
  return wrapper
}

async function save(wrapper: VueWrapper): Promise<Record<string, unknown>> {
  const confirm = wrapper.findAll('button').find((button) => button.text() === 'OK')
  await confirm?.trigger('click')
  return wrapper.emitted('save')?.[0]?.[0] as Record<string, unknown>
}

beforeEach(() => vi.stubGlobal('ResizeObserver', FakeResizeObserver))

afterEach(() => {
  mountedWrapper?.unmount()
  mountedWrapper = undefined
  vi.unstubAllGlobals()
})

describe('TextStyleEditorDialog project fonts', () => {
  it('persists the selected project font ID with its normalized descriptor', async () => {
    const wrapper = mountEditor()

    await wrapper.findComponent(Select).vm.$emit('update:modelValue', 'project-font')
    await nextTick()
    const render = await save(wrapper)

    expect(render).toMatchObject({
      fontId: 'project-font',
      fontFamily: 'Demo',
      fontWeight: 700,
      fontStyle: 'italic',
    })
  })

  it('clears the project font ID when the family is manually edited', async () => {
    const wrapper = mountEditor()
    await wrapper.findComponent(Select).vm.$emit('update:modelValue', 'project-font')
    await nextTick()

    await wrapper.get('input[list="project-fonts"]').setValue('Manual Font')
    const render = await save(wrapper)

    expect(render).toMatchObject({ fontFamily: 'Manual Font' })
    expect(render).not.toHaveProperty('fontId')
  })
})
