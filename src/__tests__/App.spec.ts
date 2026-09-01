import { describe, it, expect } from 'vitest'

import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import { i18n, setLocale } from '@/app/i18n'

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
})
