<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { getSvgPointerPosition } from '@/components/editor/svgCoordinates'
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
    keyboardLabel?: string
  }>(),
  { rotation: 0, selected: false, editable: true, minSize: 2 },
)
const emit = defineEmits<{ select: []; commit: [rect: Rect] }>()
const draft = ref<Rect>({ ...props.rect })
const moveTarget = ref<SVGRectElement>()
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
const hitPadding = computed(() => Math.max(props.minSize, handleRadius.value * 1.5))

watch(
  () => props.rect,
  (rect) => {
    if (!operation.value) draft.value = { ...rect }
  },
  { deep: true },
)

function point(event: PointerEvent): { x: number; y: number } {
  const svg = (event.currentTarget as SVGElement).ownerSVGElement
  return getSvgPointerPosition(svg, event.clientX, event.clientY, props.bounds)
}

function rotatedHalfExtent(width: number, height: number): { x: number; y: number } {
  const radians = (props.rotation * Math.PI) / 180
  const cosine = Math.abs(Math.cos(radians))
  const sine = Math.abs(Math.sin(radians))
  return {
    x: (cosine * width + sine * height) / 2,
    y: (sine * width + cosine * height) / 2,
  }
}

function constrain(rect: Rect): Rect {
  const width = Math.min(Math.max(props.minSize, rect.width), props.bounds.width)
  const height = Math.min(Math.max(props.minSize, rect.height), props.bounds.height)
  const extent = rotatedHalfExtent(width, height)
  const centerX = rect.x + width / 2
  const centerY = rect.y + height / 2

  // Keep the visible, rotated rectangle inside the Sprite whenever it can fit.
  // If it cannot, center it on that axis so its exposed handles stay symmetric.
  const constrainedCenterX =
    extent.x <= props.bounds.width
      ? Math.min(Math.max(extent.x, centerX), props.bounds.width - extent.x)
      : props.bounds.width / 2
  const constrainedCenterY =
    extent.y <= props.bounds.height
      ? Math.min(Math.max(extent.y, centerY), props.bounds.height - extent.y)
      : props.bounds.height / 2
  return {
    x: constrainedCenterX - width / 2,
    y: constrainedCenterY - height / 2,
    width,
    height,
  }
}

function localDelta(deltaX: number, deltaY: number): { x: number; y: number } {
  const radians = (props.rotation * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return {
    x: cosine * deltaX + sine * deltaY,
    y: -sine * deltaX + cosine * deltaY,
  }
}

function rotateVector(x: number, y: number): { x: number; y: number } {
  const radians = (props.rotation * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return { x: cosine * x - sine * y, y: sine * x + cosine * y }
}

function transform(rect: Rect, handle: Handle, deltaX: number, deltaY: number): Rect {
  if (handle === 'move') return constrain({ ...rect, x: rect.x + deltaX, y: rect.y + deltaY })

  const delta = localDelta(deltaX, deltaY)
  let { width, height } = rect
  if (handle.includes('west')) {
    width -= delta.x
  }
  if (handle.includes('east')) width += delta.x
  if (handle.includes('north')) {
    height -= delta.y
  }
  if (handle.includes('south')) height += delta.y
  width = Math.max(props.minSize, width)
  height = Math.max(props.minSize, height)

  const centerDelta = rotateVector(
    (handle.includes('east')
      ? width - rect.width
      : handle.includes('west')
        ? rect.width - width
        : 0) / 2,
    (handle.includes('south')
      ? height - rect.height
      : handle.includes('north')
        ? rect.height - height
        : 0) / 2,
  )
  return constrain({
    x: rect.x + centerDelta.x - (width - rect.width) / 2,
    y: rect.y + centerDelta.y - (height - rect.height) / 2,
    width,
    height,
  })
}

function begin(handle: Handle, event: PointerEvent): void {
  if (!props.editable || event.button !== 0) return
  event.stopPropagation()
  if (!props.selected) {
    emit('select')
    void nextTick(() => moveTarget.value?.focus())
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

function isEqual(left: Rect, right: Rect): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  )
}

function nudge(event: KeyboardEvent): void {
  if (
    !props.editable ||
    !props.selected ||
    operation.value ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return
  }

  const distance = event.shiftKey ? 10 : 1
  let deltaX = 0
  let deltaY = 0
  switch (event.key) {
    case 'ArrowUp':
      deltaY = -distance
      break
    case 'ArrowRight':
      deltaX = distance
      break
    case 'ArrowDown':
      deltaY = distance
      break
    case 'ArrowLeft':
      deltaX = -distance
      break
    default:
      return
  }

  event.preventDefault()
  const next = transform(draft.value, 'move', deltaX, deltaY)
  if (isEqual(draft.value, next)) return
  draft.value = next
  emit('commit', { ...next })
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
      v-if="editable"
      :x="draft.x - hitPadding"
      :y="draft.y - hitPadding"
      :width="draft.width + hitPadding * 2"
      :height="draft.height + hitPadding * 2"
      class="fill-transparent"
      pointer-events="all"
      data-testid="transform-hit-target"
      @pointerdown="begin('move', $event)"
    />
    <rect
      ref="moveTarget"
      :x="draft.x"
      :y="draft.y"
      :width="draft.width"
      :height="draft.height"
      data-testid="transform-move-target"
      class="fill-sky-400/20 stroke-2"
      :class="{
        'cursor-move stroke-sky-300': editable && selected,
        'cursor-pointer stroke-sky-500': editable && !selected,
        'stroke-sky-500': !editable,
      }"
      :tabindex="editable && selected ? 0 : undefined"
      role="group"
      :aria-label="keyboardLabel"
      aria-keyshortcuts="ArrowUp ArrowRight ArrowDown ArrowLeft Shift+ArrowUp Shift+ArrowRight Shift+ArrowDown Shift+ArrowLeft"
      @pointerdown="begin('move', $event)"
      @keydown="nudge"
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
