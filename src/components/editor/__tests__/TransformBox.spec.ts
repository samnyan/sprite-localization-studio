import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import TransformBox from '@/components/editor/TransformBox.vue'

function mountTransformBox() {
  const commits: Array<{ x: number; y: number; width: number; height: number }> = []
  const wrapper = mount({
    components: { TransformBox },
    template: `
      <svg>
        <TransformBox
          :rect="{ x: 10, y: 10, width: 20, height: 20 }"
          :bounds="{ width: 100, height: 100 }"
          selected
          @commit="commits.push($event)"
        />
      </svg>
    `,
    data: () => ({ commits }),
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
})
