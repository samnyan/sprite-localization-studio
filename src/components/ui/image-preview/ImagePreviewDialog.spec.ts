import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ImagePreviewDialog from '@/components/ui/image-preview/ImagePreviewDialog.vue'

describe('ImagePreviewDialog', () => {
  it('renders a contained image with the selected background and closes from its overlay dialog', async () => {
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

    wrapper.findComponent(dialog).vm.$emit('update:open', false)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toEqual([[]])
  })
})
