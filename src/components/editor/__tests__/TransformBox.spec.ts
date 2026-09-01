import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'

import TransformBox from '@/components/editor/TransformBox.vue'

function mountTransformBox(
  rect = { x: 10, y: 10, width: 20, height: 20 },
  rotation = 0,
  bounds = { width: 100, height: 100 },
) {
  const commits: Array<{ x: number; y: number; width: number; height: number }> = []
  const wrapper = mount({
    components: { TransformBox },
    template: `
      <svg>
        <TransformBox
          :rect="rect"
          :bounds="bounds"
          :rotation="rotation"
          selected
          keyboard-label="Move text region"
          @commit="commits.push($event)"
        />
      </svg>
    `,
    data: () => ({ bounds, commits, rect, rotation }),
  })

  Object.defineProperty(wrapper.get('svg').element, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: bounds.width, height: bounds.height }),
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

    expect(wrapper.findAll('rect')).toHaveLength(10)
  })

  it('expands the transparent drag target for a narrow text region', () => {
    const { wrapper } = mountTransformBox({ x: 10, y: 10, width: 2, height: 40 })
    const target = wrapper.findComponent(TransformBox).get('[data-testid="transform-hit-target"]')

    expect(target.attributes()).toMatchObject({ x: '7', y: '7', width: '8', height: '46' })
  })

  it('moves within its bounds and commits when released', async () => {
    const { wrapper, commits } = mountTransformBox()
    const transformBox = wrapper.findComponent(TransformBox)

    await dispatchPointer(
      transformBox.get('[data-testid="transform-move-target"]').element,
      'pointerdown',
      20,
      20,
    )
    await dispatchPointer(transformBox.get('g').element, 'pointermove', 110, 90)
    await dispatchPointer(transformBox.get('g').element, 'pointerup', 110, 90)

    expect(commits).toEqual([{ x: 80, y: 80, width: 20, height: 20 }])
  })

  it('resizes from an edge and commits the new dimensions', async () => {
    const { wrapper, commits } = mountTransformBox()
    const transformBox = wrapper.findComponent(TransformBox)
    const eastHandle = transformBox.findAll('rect')[5]
    if (!eastHandle) throw new Error('Missing east resize handle')

    await dispatchPointer(eastHandle.element, 'pointerdown', 30, 20)
    await dispatchPointer(transformBox.get('g').element, 'pointermove', 60, 20)
    await dispatchPointer(transformBox.get('g').element, 'pointerup', 60, 20)

    expect(commits).toEqual([{ x: 10, y: 10, width: 50, height: 20 }])
  })

  it('resizes along the rotated handle axis while preserving the opposite edge', async () => {
    const { wrapper, commits } = mountTransformBox(undefined, 90)
    const transformBox = wrapper.findComponent(TransformBox)
    const eastHandle = transformBox.findAll('rect')[5]
    if (!eastHandle) throw new Error('Missing east resize handle')

    await dispatchPointer(eastHandle.element, 'pointerdown', 20, 30)
    await dispatchPointer(transformBox.get('g').element, 'pointermove', 20, 60)
    await dispatchPointer(transformBox.get('g').element, 'pointerup', 20, 60)

    expect(commits).toEqual([{ x: -5, y: 25, width: 50, height: 20 }])
  })

  it('swaps effective resize limits for a 90 degree rotation', async () => {
    const { wrapper, commits } = mountTransformBox(
      { x: 0, y: 0, width: 14, height: 14 },
      90,
      { width: 14, height: 182 },
    )
    const transformBox = wrapper.findComponent(TransformBox)
    const eastHandle = transformBox.findAll('rect')[5]
    if (!eastHandle) throw new Error('Missing east resize handle')

    await dispatchPointer(eastHandle.element, 'pointerdown', 7, 14)
    await dispatchPointer(transformBox.get('g').element, 'pointermove', 7, 300)
    await dispatchPointer(transformBox.get('g').element, 'pointerup', 7, 300)

    expect(commits).toHaveLength(1)
    expect(commits[0]).toMatchObject({ width: 182, height: 14 })
    expect(commits[0]!.x).toBeCloseTo(-84)
    expect(commits[0]!.y).toBeCloseTo(84)
  })

  it('keeps a rotated region visually inside the Sprite bounds while moving', async () => {
    const { wrapper, commits } = mountTransformBox({ x: 0, y: 10, width: 20, height: 40 }, 90)
    const transformBox = wrapper.findComponent(TransformBox)

    await dispatchPointer(transformBox.findAll('rect')[1]!.element, 'pointerdown', 10, 30)
    await dispatchPointer(transformBox.get('g').element, 'pointermove', -50, 30)
    await dispatchPointer(transformBox.get('g').element, 'pointerup', -50, 30)

    expect(commits).toEqual([{ x: 10, y: 10, width: 20, height: 40 }])
  })

  it('moves the selected region by arrow keys and exposes its keyboard instructions', async () => {
    const { wrapper, commits } = mountTransformBox()
    const rect = wrapper.findComponent(TransformBox).get('[data-testid="transform-move-target"]')

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
    const rect = wrapper.findComponent(TransformBox).get('[data-testid="transform-move-target"]')

    await rect.trigger('keydown', { key: 'ArrowRight' })
    await rect.trigger('keydown', { key: 'ArrowDown', shiftKey: true })

    expect(commits).toEqual([])
  })

  it('ignores keyboard input during an active pointer operation', async () => {
    const { wrapper, commits } = mountTransformBox()
    const transformBox = wrapper.findComponent(TransformBox)
    const rect = transformBox.get('[data-testid="transform-move-target"]')

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
    const rect = transformBox.get('[data-testid="transform-move-target"]')
    const focus = vi.fn<() => void>()
    Object.defineProperty(rect.element, 'focus', { value: focus })

    expect(rect.attributes('tabindex')).toBeUndefined()
    await dispatchPointer(rect.element, 'pointerdown', 20, 20)
    await nextTick()

    expect(rect.attributes('tabindex')).toBe('0')
    expect(focus).toHaveBeenCalledOnce()
  })
})
