<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { Rect, Size } from '@/domain/shared/geometry'

type Handle =
  | 'move'
  | 'north'
  | 'east'
  | 'south'
  | 'west'
  | 'north-east'
  | 'south-east'
  | 'south-west'
  | 'north-west'

const props = withDefaults(
  defineProps<{
    rect: Rect
    bounds: Size
    rotation?: number
    selected?: boolean
    editable?: boolean
    minSize?: number
  }>(),
  { rotation: 0, selected: false, editable: true, minSize: 2 },
)
const emit = defineEmits<{ select: []; commit: [rect: Rect] }>()
const draft = ref<Rect>({ ...props.rect })
const operation = ref<{ handle: Handle; point: { x: number; y: number }; rect: Rect }>()
const handles: Array<{ handle: Handle; cursor: string }> = [
  { handle: 'north-west', cursor: 'nwse-resize' },
  { handle: 'north', cursor: 'ns-resize' },
  { handle: 'north-east', cursor: 'nesw-resize' },
  { handle: 'east', cursor: 'ew-resize' },
  { handle: 'south-east', cursor: 'nwse-resize' },
  { handle: 'south', cursor: 'ns-resize' },
  { handle: 'south-west', cursor: 'nesw-resize' },
  { handle: 'west', cursor: 'ew-resize' },
]
const handleRadius = computed(() =>
  Math.max(2, Math.min(props.bounds.width, props.bounds.height) / 75),
)

watch(
  () => props.rect,
  (rect) => {
    if (!operation.value) draft.value = { ...rect }
  },
  { deep: true },
)

function point(event: PointerEvent): { x: number; y: number } {
  const svg = (event.currentTarget as SVGElement).ownerSVGElement
  const box = svg?.getBoundingClientRect()
  if (!box) return { x: 0, y: 0 }
  return {
    x: ((event.clientX - box.left) / box.width) * props.bounds.width,
    y: ((event.clientY - box.top) / box.height) * props.bounds.height,
  }
}

function constrain(rect: Rect): Rect {
  const width = Math.min(Math.max(props.minSize, rect.width), props.bounds.width)
  const height = Math.min(Math.max(props.minSize, rect.height), props.bounds.height)
  return {
    x: Math.min(Math.max(0, rect.x), props.bounds.width - width),
    y: Math.min(Math.max(0, rect.y), props.bounds.height - height),
    width,
    height,
  }
}

function transform(rect: Rect, handle: Handle, deltaX: number, deltaY: number): Rect {
  if (handle === 'move') return constrain({ ...rect, x: rect.x + deltaX, y: rect.y + deltaY })

  let { x, y, width, height } = rect
  if (handle.includes('west')) {
    x += deltaX
    width -= deltaX
  }
  if (handle.includes('east')) width += deltaX
  if (handle.includes('north')) {
    y += deltaY
    height -= deltaY
  }
  if (handle.includes('south')) height += deltaY
  if (width < props.minSize) {
    if (handle.includes('west')) x -= props.minSize - width
    width = props.minSize
  }
  if (height < props.minSize) {
    if (handle.includes('north')) y -= props.minSize - height
    height = props.minSize
  }
  return constrain({ x, y, width, height })
}

function begin(handle: Handle, event: PointerEvent): void {
  if (!props.editable || event.button !== 0) return
  event.stopPropagation()
  if (!props.selected) {
    emit('select')
    return
  }
  operation.value = { handle, point: point(event), rect: { ...draft.value } }
  ;(event.currentTarget as SVGElement).setPointerCapture?.(event.pointerId)
}

function move(event: PointerEvent): void {
  const current = operation.value
  if (!current) return
  const currentPoint = point(event)
  draft.value = transform(
    current.rect,
    current.handle,
    currentPoint.x - current.point.x,
    currentPoint.y - current.point.y,
  )
}

function finish(): void {
  if (!operation.value) return
  operation.value = undefined
  emit('commit', { ...draft.value })
}

function position(handle: Handle): { x: number; y: number } {
  const { x, y, width, height } = draft.value
  const centerX = x + width / 2
  const centerY = y + height / 2
  switch (handle) {
    case 'north-west':
      return { x, y }
    case 'north':
      return { x: centerX, y }
    case 'north-east':
      return { x: x + width, y }
    case 'east':
      return { x: x + width, y: centerY }
    case 'south-east':
      return { x: x + width, y: y + height }
    case 'south':
      return { x: centerX, y: y + height }
    case 'south-west':
      return { x, y: y + height }
    case 'west':
      return { x, y: centerY }
    default:
      return { x: centerX, y: centerY }
  }
}
</script>

<template>
  <g
    :transform="
      rotation
        ? `rotate(${rotation} ${draft.x + draft.width / 2} ${draft.y + draft.height / 2})`
        : undefined
    "
    @pointermove="move"
    @pointerup="finish"
    @pointercancel="finish"
  >
    <rect
      :x="draft.x"
      :y="draft.y"
      :width="draft.width"
      :height="draft.height"
      class="fill-sky-400/20 stroke-2"
      :class="{
        'cursor-move stroke-sky-300': editable && selected,
        'cursor-pointer stroke-sky-500': editable && !selected,
        'stroke-sky-500': !editable,
      }"
      @pointerdown="begin('move', $event)"
    />
    <template v-if="editable && selected">
      <rect
        v-for="item in handles"
        :key="item.handle"
        :x="position(item.handle).x - handleRadius"
        :y="position(item.handle).y - handleRadius"
        :width="handleRadius * 2"
        :height="handleRadius * 2"
        class="fill-background stroke-sky-300"
        :style="{ cursor: item.cursor }"
        @pointerdown="begin(item.handle, $event)"
      />
    </template>
  </g>
</template>
