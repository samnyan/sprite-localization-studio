<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Size } from '@/domain/shared/geometry'
import type { Sprite } from '@/domain/sprite/types'
import {
  getLogicalSpriteSize,
  getLogicalTrimmedSize,
  getStoredToLogicalTransform,
} from '@/infrastructure/image/spriteGeometry'

const props = defineProps<{
  imageUrl: string
  textureSize: Size
  sprite: Sprite
}>()

const { t } = useI18n()
const canvas = ref<HTMLCanvasElement>()
const errorKey = ref('')
let renderId = 0

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image-load-failed'))
    image.src = url
  })
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

    const logicalSize = getLogicalSpriteSize(props.sprite)
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

    target.width = logicalSize.width
    target.height = logicalSize.height
    targetContext.clearRect(0, 0, logicalSize.width, logicalSize.height)
    targetContext.drawImage(
      normalized,
      props.sprite.trimOffset?.x ?? 0,
      props.sprite.trimOffset?.y ?? 0,
    )
  } catch {
    if (currentRenderId === renderId) {
      errorKey.value = 'errors.spriteTable.imageLoadFailed'
    }
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
    <div
      v-else
      class="relative flex max-h-full max-w-full items-center justify-center border bg-checkerboard p-4 shadow-sm"
    >
      <canvas
        ref="canvas"
        class="block max-h-[calc(100vh-12rem)] max-w-[calc(100vw-38rem)] [image-rendering:pixelated]"
        :aria-label="sprite.name"
      ></canvas>
      <span
        class="absolute right-1.5 bottom-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
      >
        {{ getLogicalSpriteSize(sprite).width }} × {{ getLogicalSpriteSize(sprite).height }}
      </span>
    </div>
  </div>
</template>
