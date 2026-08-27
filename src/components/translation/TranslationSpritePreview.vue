<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { Size } from '@/domain/shared/geometry'
import type { Sprite } from '@/domain/sprite/types'
import type { SpriteTranslation } from '@/domain/text-region/types'
import type { PreviewBackground } from '@/app/stores/workspace'
import { drawTranslationText } from '@/infrastructure/image/textRenderer'
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
  }>(),
  { previewWidth: 224, previewHeight: 144, previewBackground: 'transparent' },
)

const canvas = ref<HTMLCanvasElement>()
let renderId = 0

const backgroundClass = computed(() => {
  if (props.previewBackground === 'black') return 'bg-black'
  if (props.previewBackground === 'white') return 'bg-white'
  return 'bg-checkerboard'
})

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image-load-failed'))
    image.src = url
  })
}

async function render(): Promise<void> {
  const currentRenderId = ++renderId
  await nextTick()

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
    const context = canvas.value.getContext('2d')
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

    canvas.value.width = logicalSize.width
    canvas.value.height = logicalSize.height
    context.clearRect(0, 0, logicalSize.width, logicalSize.height)
    if (props.output && props.backgroundUrl) {
      const background = await loadImage(props.backgroundUrl)
      if (currentRenderId !== renderId) return
      context.drawImage(background, 0, 0, logicalSize.width, logicalSize.height)
    } else if (!props.outputBlank) {
      context.drawImage(extracted, props.sprite.trimOffset?.x ?? 0, props.sprite.trimOffset?.y ?? 0)
    }
    if (props.output && props.translation)
      drawTranslationText(context, props.translation.textRegions)
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
    ] as const,
  () => void render(),
  { immediate: true, deep: true },
)
</script>

<template>
  <div
    class="inline-flex max-w-full items-center justify-center overflow-hidden rounded border"
    :class="backgroundClass"
  >
    <canvas
      ref="canvas"
      class="block h-full w-full [image-rendering:pixelated]"
      :aria-label="sprite.name"
    ></canvas>
  </div>
</template>
