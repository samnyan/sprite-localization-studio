<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { Size } from '@/domain/shared/geometry'
import type { Sprite } from '@/domain/sprite/types'
import type { SpriteTranslation } from '@/domain/text-region/types'
import type { PreviewBackground } from '@/app/stores/workspace'
import { drawTranslationText } from '@/infrastructure/image/textRenderer'
import { drawCanvasKitTextOverlay } from '@/infrastructure/rendering/CanvasKitTextOverlay'
import {
  getLogicalSpriteSize,
  getLogicalTrimmedSize,
  getStoredToLogicalTransform,
} from '@/infrastructure/image/spriteGeometry'

const props = withDefaults(
  defineProps<{
    imageUrl: string
    textureSize: Size
    sprite: Sprite
    translation?: SpriteTranslation
    backgroundUrl?: string
    output?: boolean
    outputBlank?: boolean
    previewWidth?: number
    previewHeight?: number
    previewBackground?: PreviewBackground
    enlarged?: boolean
  }>(),
  { previewWidth: 224, previewHeight: 144, previewBackground: 'transparent', enlarged: false },
)

const canvas = ref<HTMLCanvasElement>()
let renderId = 0
let frame: number | undefined
let disposed = false

const backgroundClass = computed(() => {
  if (props.previewBackground === 'black') return 'bg-black'
  if (props.previewBackground === 'white') return 'bg-white'
  return 'bg-checkerboard'
})
const displayRotation = computed(() => {
  const rotations = props.translation?.textRegions.map(
    (region) => ((region.rotation % 360) + 360) % 360,
  )
  if (!rotations?.length || !rotations.every((rotation) => rotation === rotations[0])) return 0
  return rotations[0] === 90 || rotations[0] === 180 || rotations[0] === 270
    ? rotations[0]
    : 0
})

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image-load-failed'))
    image.src = url
  })
}

function scheduleRender(): void {
  renderId += 1
  if (frame !== undefined) return
  void nextTick(() => {
    if (disposed) return
    frame = window.requestAnimationFrame(() => {
      frame = undefined
      void render(renderId)
    })
  })
}

async function render(currentRenderId: number): Promise<void> {
  try {
    const image = await loadImage(props.imageUrl)
    if (currentRenderId !== renderId || !canvas.value) return
    if (
      image.naturalWidth !== props.textureSize.width ||
      image.naturalHeight !== props.textureSize.height
    )
      return

    const logicalSize = getLogicalSpriteSize(props.sprite)
    const storedSize = getLogicalTrimmedSize(props.sprite)
    const extracted = document.createElement('canvas')
    extracted.width = storedSize.width
    extracted.height = storedSize.height
    const extractedContext = extracted.getContext('2d')
    const target = canvas.value
    const logicalCanvas = document.createElement('canvas')
    const context = logicalCanvas.getContext('2d')
    if (!extractedContext || !context) return

    const transform = getStoredToLogicalTransform(props.sprite)
    extractedContext.setTransform(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f,
    )
    extractedContext.drawImage(
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

    logicalCanvas.width = logicalSize.width
    logicalCanvas.height = logicalSize.height
    context.clearRect(0, 0, logicalSize.width, logicalSize.height)
    if (props.output && props.backgroundUrl) {
      const background = await loadImage(props.backgroundUrl)
      if (currentRenderId !== renderId) return
      context.drawImage(background, 0, 0, logicalSize.width, logicalSize.height)
    } else if (!props.outputBlank) {
      context.drawImage(extracted, props.sprite.trimOffset?.x ?? 0, props.sprite.trimOffset?.y ?? 0)
    }
    if (props.output && props.translation) {
      try {
        const rendered = await drawCanvasKitTextOverlay(
          logicalCanvas,
          props.translation.textRegions,
          () => currentRenderId === renderId && canvas.value === target,
        )
        if (currentRenderId !== renderId) return
        if (!rendered) {
          drawTranslationText(context, props.translation.textRegions)
        }
      } catch {
        if (currentRenderId !== renderId || canvas.value !== target) return
        drawTranslationText(context, props.translation.textRegions)
      }
    }

    if (currentRenderId !== renderId || canvas.value !== target) return
    const rotation = displayRotation.value
    const quarterTurn = rotation === 90 || rotation === 270
    target.width = quarterTurn ? logicalSize.height : logicalSize.width
    target.height = quarterTurn ? logicalSize.width : logicalSize.height
    const targetContext = target.getContext('2d')
    if (!targetContext) return
    if (rotation === 90) {
      targetContext.translate(0, target.height)
      targetContext.rotate(-Math.PI / 2)
    } else if (rotation === 180) {
      targetContext.translate(target.width, target.height)
      targetContext.rotate(Math.PI)
    } else if (rotation === 270) {
      targetContext.translate(target.width, 0)
      targetContext.rotate(Math.PI / 2)
    }
    targetContext.drawImage(logicalCanvas, 0, 0)
  } catch {
    return
  }
}

watch(
  () =>
    [
      props.imageUrl,
      props.textureSize,
      props.sprite,
      props.translation,
      props.backgroundUrl,
      props.output,
      displayRotation.value,
    ] as const,
  scheduleRender,
  { immediate: true, deep: true },
)

onBeforeUnmount(() => {
  disposed = true
  if (frame !== undefined) window.cancelAnimationFrame(frame)
})
</script>

<template>
  <div
    class="flex items-center justify-center overflow-hidden rounded border"
    :class="[backgroundClass, enlarged ? 'size-full' : 'inline-flex max-w-full']"
  >
    <canvas
      ref="canvas"
      class="block h-full w-full object-contain [image-rendering:auto]"
      :aria-label="sprite.name"
    ></canvas>
  </div>
</template>
