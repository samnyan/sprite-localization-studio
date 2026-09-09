import { describe, it, expect, vi } from 'vitest'

import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import { i18n, setLocale } from '@/app/i18n'
import { setWorkspaceProjectSessionForTesting, useWorkspaceStore } from '@/app/stores/workspace'
import type { ProjectRepository } from '@/application/project/ProjectRepository'

describe('App', () => {
  it('renders the application menu and switches languages', async () => {
    setLocale('en')
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div>Home</div>' } }],
    })
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router, i18n],
      },
    })

    expect(wrapper.text()).toContain('Sprite Localization Studio')
    expect(wrapper.text()).toContain('File')

    await wrapper.get('#app-language').setValue('zh-CN')
    expect(wrapper.text()).toContain('文件')
    expect(wrapper.text()).toContain('贴图翻译助手')

    setLocale('en')
  })

  it('renames the project from the top project name menu', async () => {
    setLocale('en')
    const pinia = createPinia()
    setActivePinia(pinia)
    const save = vi.fn<(project: unknown) => Promise<void>>(async () => undefined)
    setWorkspaceProjectSessionForTesting({ save } as unknown as ProjectRepository)
    const workspace = useWorkspaceStore()
    workspace.project = { schemaVersion: 3, name: 'Example' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div>Home</div>' } }],
    })
    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router, i18n],
        stubs: {
          ContextMenu: { template: '<div><slot /></div>' },
          ContextMenuTrigger: { props: ['asChild'], template: '<slot />' },
          ContextMenuContent: { template: '<div><slot /></div>' },
          ContextMenuItem: {
            emits: ['select'],
            template: '<button v-bind="$attrs" @click="$emit(\'select\')"><slot /></button>',
          },
          Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
          DialogContent: { template: '<div><slot /></div>' },
          DialogFooter: { template: '<div><slot /></div>' },
          DialogHeader: { template: '<div><slot /></div>' },
          DialogTitle: { template: '<h2><slot /></h2>' },
          LooseSpriteImportDialog: { template: '<div />' },
        },
      },
    })

    expect(wrapper.get('[data-testid="project-name-menu"]').text()).toContain('Example')
    await wrapper.get('[data-testid="rename-project"]').trigger('click')
    const input = wrapper.get<HTMLInputElement>('input[aria-label="Name"]')
    expect(input.element.value).toBe('Example')

    await input.setValue('Renamed Project')
    await wrapper.get('[data-testid="confirm-project-rename"]').trigger('click')
    await flushPromises()

    expect(workspace.project?.name).toBe('Renamed Project')
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed Project' }))
    expect(wrapper.find('input[aria-label="Name"]').exists()).toBe(false)
    setWorkspaceProjectSessionForTesting()
  })
})
