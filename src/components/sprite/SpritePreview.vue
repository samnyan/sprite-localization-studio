<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import TransformBox from '@/components/editor/TransformBox.vue'
import { getSvgPointerPosition } from '@/components/editor/svgCoordinates'
import type { Size } from '@/domain/shared/geometry'
import type { Sprite } from '@/domain/sprite/types'
import type { TextRegion } from '@/domain/text-region/types'
import {
  getLogicalSpriteSize,
  getLogicalTrimmedSize,
  getStoredToLogicalTransform,
} from '@/infrastructure/image/spriteGeometry'

const props = defineProps<{
  imageUrl: string
  textureSize: Size
  sprite: Sprite
  textRegions?: TextRegion[]
  selectedTextRegionId?: string
  editable?: boolean
}>()

const emit = defineEmits<{
  createRegion: [rect: { x: number; y: number; width: number; height: number }]
  selectRegion: [regionId?: string]
  updateRegion: [regionId: string, rect: { x: number; y: number; width: number; height: number }]
}>()

const { t } = useI18n()
const canvas = ref<HTMLCanvasElement>()
const errorKey = ref('')
const drawStart = ref<{ x: number; y: number }>()
const drawingRect = ref<{ x: number; y: number; width: number; height: number }>()
let renderId = 0

const logicalSize = computed(() => getLogicalSpriteSize(props.sprite))
const regions = computed(() => props.textRegions ?? [])

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image-load-failed'))
    image.src = url
  })
}

function normalizeRect(start: { x: number; y: number }, end: { x: number; y: number }) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

function pointerPosition(event: PointerEvent): { x: number; y: number } {
  const svg = event.currentTarget as SVGSVGElement
  const local = getSvgPointerPosition(svg, event.clientX, event.clientY, logicalSize.value)
  return {
    x: Math.max(0, Math.min(logicalSize.value.width, local.x)),
    y: Math.max(0, Math.min(logicalSize.value.height, local.y)),
  }
}

function beginRegion(event: PointerEvent): void {
  if (!props.editable || event.button !== 0) return
  drawStart.value = pointerPosition(event)
  drawingRect.value = undefined
  ;(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId)
  emit('selectRegion')
}

function updateRegion(event: PointerEvent): void {
  if (!drawStart.value) return
  drawingRect.value = normalizeRect(drawStart.value, pointerPosition(event))
}

function finishRegion(event: PointerEvent): void {
  if (!drawStart.value) return
  const rect = normalizeRect(drawStart.value, pointerPosition(event))
  drawStart.value = undefined
  drawingRect.value = undefined
  if (rect.width >= 2 && rect.height >= 2) emit('createRegion', rect)
}

async function renderSprite(): Promise<void> {
  const currentRenderId = ++renderId
  errorKey.value = ''
  await nextTick()

  try {
    const image = await loadImage(props.imageUrl)
    if (currentRenderId !== renderId) return
    if (
      image.naturalWidth !== props.textureSize.width ||
      image.naturalHeight !== props.textureSize.height
    ) {
      errorKey.value = 'errors.spriteTable.imageSizeMismatch'
      return
    }

    const target = canvas.value
    const targetContext = target?.getContext('2d')
    if (!target || !targetContext) {
      errorKey.value = 'errors.spriteTable.previewUnavailable'
      return
    }

    const trimmedSize = getLogicalTrimmedSize(props.sprite)
    const normalized = document.createElement('canvas')
    const normalizedContext = normalized.getContext('2d')
    if (!normalizedContext) {
      errorKey.value = 'errors.spriteTable.previewUnavailable'
      return
    }

    normalized.width = trimmedSize.width
    normalized.height = trimmedSize.height
    const transform = getStoredToLogicalTransform(props.sprite)
    normalizedContext.setTransform(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f,
    )
    normalizedContext.drawImage(
      image,
      props.sprite.frame.x,
      props.sprite.frame.y,
      props.sprite.frame.width,
      props.sprite.frame.height,
      0,
      0,
      props.sprite.frame.width,
      props.sprite.frame.height,
    )

    target.width = logicalSize.value.width
    target.height = logicalSize.value.height
    targetContext.clearRect(0, 0, logicalSize.value.width, logicalSize.value.height)
    targetContext.drawImage(
      normalized,
      props.sprite.trimOffset?.x ?? 0,
      props.sprite.trimOffset?.y ?? 0,
    )
  } catch {
    if (currentRenderId === renderId) errorKey.value = 'errors.spriteTable.imageLoadFailed'
  }
}

watch(
  () => [props.imageUrl, props.textureSize, props.sprite] as const,
  () => void renderSprite(),
  { immediate: true },
)
</script>

<template>
  <div class="flex size-full min-h-0 items-center justify-center overflow-auto p-8">
    <div v-if="errorKey" class="text-sm text-destructive" role="alert">{{ t(errorKey) }}</div>
    <div v-else class="relative max-h-full max-w-full border bg-checkerboard p-4 shadow-sm">
      <div class="relative">
        <canvas
          ref="canvas"
          class="block max-h-[calc(100vh-12rem)] max-w-[calc(100vw-38rem)] [image-rendering:auto]"
          :aria-label="sprite.name"
        ></canvas>
        <svg
          v-if="editable || regions.length"
          class="absolute inset-0 h-full w-full touch-none overflow-visible"
          :class="{ 'cursor-crosshair': editable }"
          :viewBox="`0 0 ${logicalSize.width} ${logicalSize.height}`"
          preserveAspectRatio="none"
          @pointerdown.self="beginRegion"
          @pointermove="updateRegion"
          @pointerup="finishRegion"
          @pointercancel="finishRegion"
        >
          <TransformBox
            v-for="region in regions"
            :key="region.id"
            :rect="region.rect"
            :bounds="logicalSize"
            :rotation="region.rotation"
            :selected="region.id === selectedTextRegionId"
            :editable="editable"
            :keyboard-label="t('textRegion.keyboardMove', { key: region.translationKey })"
            @select="emit('selectRegion', region.id)"
            @commit="emit('updateRegion', region.id, $event)"
          />
          <rect
            v-if="drawingRect"
            :x="drawingRect.x"
            :y="drawingRect.y"
            :width="drawingRect.width"
            :height="drawingRect.height"
            class="fill-sky-400/15 stroke-2 stroke-sky-300 stroke-dasharray-[4_2]"
          />
        </svg>
      </div>
      <span
        class="absolute right-1.5 bottom-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
      >
        {{ logicalSize.width }} × {{ logicalSize.height }}
      </span>
    </div>
  </div>
</template>
