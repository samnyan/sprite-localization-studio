import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { i18n, setLocale } from '@/app/i18n'
import ImagePreviewDialog from '@/components/ui/image-preview/ImagePreviewDialog.vue'

describe('ImagePreviewDialog', () => {
  it('renders a contained image with the selected background and closes from its overlay dialog', async () => {
    setLocale('en')
    const dialog = {
      props: ['open'],
      emits: ['update:open'],
      template: '<div data-testid="dialog"><slot /></div>',
    }
    const wrapper = mount(ImagePreviewDialog, {
      props: {
        open: true,
        imageUrl: 'blob:image',
        alt: 'Preview image',
        background: 'black',
      },
      global: {
        plugins: [i18n],
        stubs: {
          Dialog: dialog,
          DialogContent: { template: '<div><slot /></div>' },
          DialogHeader: { template: '<div><slot /></div>' },
          DialogTitle: { template: '<span><slot /></span>' },
        },
      },
    })

    expect(wrapper.get('img').attributes()).toMatchObject({ src: 'blob:image', alt: 'Preview image' })
    expect(wrapper.get('img').classes()).toContain('object-contain')
    expect(wrapper.get('img').element.parentElement?.classList).toContain('bg-black')
    expect(wrapper.get('[aria-label="Close preview"]').classes()).toContain('fixed')
    expect(wrapper.get('[aria-label="Close preview"]').classes()).toContain('bg-black')

    wrapper.findComponent(dialog).vm.$emit('update:open', false)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('navigates image lists with controls and arrow keys', async () => {
    setLocale('en')
    const wrapper = mount(ImagePreviewDialog, {
      props: {
        open: true,
        images: [
          { src: 'blob:first', title: 'First' },
          { src: 'blob:second', title: 'Second' },
        ],
      },
      global: {
        plugins: [i18n],
        stubs: {
          Dialog: { template: '<div><slot /></div>' },
          DialogContent: { template: '<div><slot /></div>' },
          DialogHeader: { template: '<div><slot /></div>' },
          DialogTitle: { template: '<span><slot /></span>' },
        },
      },
    })

    await wrapper.get('[aria-label="Next image"]').trigger('click')
    expect(wrapper.get('img').attributes('src')).toBe('blob:second')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('img').attributes('src')).toBe('blob:first')
    wrapper.unmount()
  })

  it('opens a comparison view at the requested image and switches from its tabs', async () => {
    setLocale('en')
    const wrapper = mount(ImagePreviewDialog, {
      props: {
        open: true,
        initialIndex: 1,
        mode: 'compare',
        images: [
          { src: 'blob:original', title: 'Original sprite' },
          { src: 'blob:output', title: 'Output' },
        ],
      },
      global: {
        plugins: [i18n],
        stubs: {
          Dialog: { template: '<div><slot /></div>' },
          DialogContent: { template: '<div><slot /></div>' },
          DialogHeader: { template: '<div><slot /></div>' },
          DialogTitle: { template: '<span><slot /></span>' },
        },
      },
    })

    expect(wrapper.get('img').attributes('src')).toBe('blob:output')
    await wrapper.get('[role="tab"][aria-selected="false"]').trigger('click')
    expect(wrapper.get('img').attributes('src')).toBe('blob:original')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('img').attributes('src')).toBe('blob:output')
    wrapper.unmount()
  })
})
