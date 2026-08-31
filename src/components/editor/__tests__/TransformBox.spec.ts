import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'

import TransformBox from '@/components/editor/TransformBox.vue'

function mountTransformBox(rect = { x: 10, y: 10, width: 20, height: 20 }) {
  const commits: Array<{ x: number; y: number; width: number; height: number }> = []
  const wrapper = mount({
    components: { TransformBox },
    template: `
      <svg>
        <TransformBox
          :rect="rect"
          :bounds="{ width: 100, height: 100 }"
          selected
          keyboard-label="Move text region"
          @commit="commits.push($event)"
        />
      </svg>
    `,
    data: () => ({ commits, rect }),
  })

  Object.defineProperty(wrapper.get('svg').element, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  })

  return { wrapper, commits }
}

async function dispatchPointer(
  element: Element,
  type: string,
  clientX: number,
  clientY: number,
): Promise<void> {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX,
    clientY,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  element.dispatchEvent(event)
  await nextTick()
}

describe('TransformBox', () => {
  it('renders drag and eight resize handles when selected', () => {
    const { wrapper } = mountTransformBox()

    expect(wrapper.findAll('rect')).toHaveLength(9)
  })

  it('moves within its bounds and commits when released', async () => {
    const { wrapper, commits } = mountTransformBox()
    const transformBox = wrapper.findComponent(TransformBox)

    await dispatchPointer(transformBox.get('rect').element, 'pointerdown', 20, 20)
    await dispatchPointer(transformBox.get('g').element, 'pointermove', 110, 90)
    await dispatchPointer(transformBox.get('g').element, 'pointerup', 110, 90)

    expect(commits).toEqual([{ x: 80, y: 80, width: 20, height: 20 }])
  })

  it('resizes from an edge and commits the new dimensions', async () => {
    const { wrapper, commits } = mountTransformBox()
    const transformBox = wrapper.findComponent(TransformBox)
    const eastHandle = transformBox.findAll('rect')[4]
    if (!eastHandle) throw new Error('Missing east resize handle')

    await dispatchPointer(eastHandle.element, 'pointerdown', 30, 20)
    await dispatchPointer(transformBox.get('g').element, 'pointermove', 60, 20)
    await dispatchPointer(transformBox.get('g').element, 'pointerup', 60, 20)

    expect(commits).toEqual([{ x: 10, y: 10, width: 50, height: 20 }])
  })

  it('moves the selected region by arrow keys and exposes its keyboard instructions', async () => {
    const { wrapper, commits } = mountTransformBox()
    const rect = wrapper.findComponent(TransformBox).get('rect')

    expect(rect.attributes('tabindex')).toBe('0')
    expect(rect.attributes('aria-label')).toBe('Move text region')
    await rect.trigger('keydown', { key: 'ArrowRight' })
    await rect.trigger('keydown', { key: 'ArrowDown', shiftKey: true })

    expect(commits).toEqual([
      { x: 11, y: 10, width: 20, height: 20 },
      { x: 11, y: 20, width: 20, height: 20 },
    ])
  })

  it('does not commit keyboard movement beyond the bounds', async () => {
    const { wrapper, commits } = mountTransformBox({ x: 80, y: 80, width: 20, height: 20 })
    const rect = wrapper.findComponent(TransformBox).get('rect')

    await rect.trigger('keydown', { key: 'ArrowRight' })
    await rect.trigger('keydown', { key: 'ArrowDown', shiftKey: true })

    expect(commits).toEqual([])
  })

  it('ignores keyboard input during an active pointer operation', async () => {
    const { wrapper, commits } = mountTransformBox()
    const transformBox = wrapper.findComponent(TransformBox)
    const rect = transformBox.get('rect')

    await dispatchPointer(rect.element, 'pointerdown', 20, 20)
    await rect.trigger('keydown', { key: 'ArrowRight' })
    await dispatchPointer(transformBox.get('g').element, 'pointerup', 20, 20)

    expect(commits).toEqual([{ x: 10, y: 10, width: 20, height: 20 }])
  })

  it('focuses a region after pointer selection so it can be nudged immediately', async () => {
    const selected = ref(false)
    const wrapper = mount({
      components: { TransformBox },
      setup: () => ({ selected }),
      template: `
        <svg>
          <TransformBox
            :rect="{ x: 10, y: 10, width: 20, height: 20 }"
            :bounds="{ width: 100, height: 100 }"
            :selected="selected"
            @select="selected = true"
          />
        </svg>
      `,
    })
    const transformBox = wrapper.findComponent(TransformBox)
    const rect = transformBox.get('rect')
    const focus = vi.fn<() => void>()
    Object.defineProperty(rect.element, 'focus', { value: focus })

    expect(rect.attributes('tabindex')).toBeUndefined()
    await dispatchPointer(rect.element, 'pointerdown', 20, 20)
    await nextTick()

    expect(rect.attributes('tabindex')).toBe('0')
    expect(focus).toHaveBeenCalledOnce()
  })
})
