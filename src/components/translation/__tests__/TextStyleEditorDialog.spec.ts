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

function mountEditor(props: Partial<InstanceType<typeof TextStyleEditorDialog>['$props']> = {}) {
  setLocale('en')
  const wrapper = mount(TextStyleEditorDialog, {
    props: {
      open: true,
      text: 'Start',
      render: DEFAULT_TEXT_RENDER,
      fonts: [
        {
          id: 'project-font',
          path: 'fonts/demo.ttf',
          family: 'Demo',
          weight: 700,
          style: 'italic',
        },
      ],
      ...props,
    },
    global: {
      plugins: [i18n],
      stubs: {
        Dialog: { template: '<div><slot /></div>' },
        DialogContent: { template: '<div><slot /></div>' },
        DialogFooter: { template: '<div><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        AlertDialog: { template: '<div><slot /></div>' },
        AlertDialogContent: { template: '<div><slot /></div>' },
        AlertDialogDescription: { template: '<div><slot /></div>' },
        AlertDialogFooter: { template: '<div><slot /></div>' },
        AlertDialogHeader: { template: '<div><slot /></div>' },
        AlertDialogTitle: { template: '<div><slot /></div>' },
        AlertDialogCancel: { template: '<button><slot /></button>' },
        ContextMenu: { template: '<div><slot /></div>' },
        ContextMenuContent: { template: '<div><slot /></div>' },
        ContextMenuItem: { template: '<button><slot /></button>' },
        ContextMenuSeparator: true,
        ContextMenuTrigger: { template: '<div><slot /></div>' },
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
  it('uses rounded outline joins for legacy styles that do not persist a join', async () => {
    const wrapper = mountEditor({
      render: {
        ...DEFAULT_TEXT_RENDER,
        stroke: { width: 2, position: 'outside', paint: { mode: 'solid', color: '#000000' } },
      },
    })

    const render = await save(wrapper)

    expect(render).toMatchObject({ stroke: { join: 'round' } })
  })

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

  it('allows a font family to resolve a different project weight', async () => {
    const wrapper = mountEditor()
    const selects = wrapper.findAllComponents(Select)
    await selects[0]!.vm.$emit('update:modelValue', 'project-font')
    await selects[1]!.vm.$emit('update:modelValue', '400')
    await nextTick()
    const render = await save(wrapper)

    expect(render).toMatchObject({ fontFamily: 'Demo', fontWeight: 400 })
    expect(render).not.toHaveProperty('fontId')
  })
})

describe('TextStyleEditorDialog template binding', () => {
  it('binds a selected template instead of copying it into an individual style', async () => {
    const templateRender = { ...DEFAULT_TEXT_RENDER, fontSize: 28 }
    const wrapper = mountEditor({
      styleId: 'template-1',
      templates: [{ id: 'template-1', name: 'Headline', render: templateRender }],
    })

    await wrapper.get('button[aria-label="Headline"]').trigger('click')

    expect(wrapper.emitted('save')).toEqual([[templateRender, 'template-1']])
  })

  it('saves an individual style as a template and binds it to the current region', async () => {
    const wrapper = mountEditor()

    const saveAsButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Save as template')
    await saveAsButton?.trigger('click')
    await wrapper.get('input[placeholder="Template name"]').setValue('Dialogue')
    const confirm = wrapper.findAll('button').filter((button) => button.text() === 'OK')[1]
    await confirm?.trigger('click')

    expect(wrapper.emitted('saveAsTemplate')?.[0]?.[0]).toBe('Dialogue')
    expect(wrapper.emitted('saveAsTemplate')?.[0]?.[2]).toBeUndefined()
  })

  it('offers to replace an existing template when saving with a duplicate name', async () => {
    const wrapper = mountEditor({
      templates: [{ id: 'template-1', name: 'Dialogue', render: DEFAULT_TEXT_RENDER }],
    })

    const saveAsButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Save as template')
    await saveAsButton?.trigger('click')
    await wrapper.get('input[placeholder="Template name"]').setValue('Dialogue')
    const confirm = wrapper.findAll('button').filter((button) => button.text() === 'OK')[1]
    await confirm?.trigger('click')
    const overwrite = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Overwrite template')
    await overwrite?.trigger('click')

    expect(wrapper.emitted('saveAsTemplate')?.[0]?.[2]).toBe('template-1')
  })
})
