<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { drawTextRegion } from '@/infrastructure/image/textRenderer'
import {
  drawTextRegionWithCanvasKit,
  isCanvasKitTextRenderSupported,
} from '@/infrastructure/rendering/CanvasKitTextRenderer'
import { loadCanvasKit } from '@/infrastructure/rendering/CanvasKitRuntime'
import type { TextRenderConfig } from '@/domain/text-region/types'
import type { PreviewBackground } from '@/app/stores/workspace'

const props = withDefaults(
  defineProps<{ text: string; render: TextRenderConfig; previewBackground?: PreviewBackground }>(),
  { previewBackground: 'transparent' },
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

function renderCanvas(): void {
  renderId += 1
  if (frame !== undefined) return
  void nextTick(() => {
    if (disposed) return
    frame = window.requestAnimationFrame(() => {
      frame = undefined
      void renderWithCanvasKit(renderId)
    })
  })
}

async function renderWithCanvasKit(currentRenderId: number): Promise<void> {
  const target = canvas.value
  if (!target) return
  target.width = 640
  target.height = 144
  const region = {
    id: 'preview',
    rect: { x: 20, y: 20, width: 600, height: 104 },
    rotation: 0,
    translationKey: 'preview',
  }
  try {
    if (!isCanvasKitTextRenderSupported(props.render)) throw new Error('CanvasKit style is unsupported.')
    const canvasKit = await loadCanvasKit()
    if (currentRenderId !== renderId || target !== canvas.value) return
    const surface = canvasKit.MakeSWCanvasSurface(target)
    if (!surface) throw new Error('CanvasKit surface unavailable.')
    try {
      surface.getCanvas().clear(canvasKit.TRANSPARENT)
      drawTextRegionWithCanvasKit(
        canvasKit,
        surface.getCanvas(),
        props.text || 'Preview',
        region,
        props.render,
      )
      surface.flush()
    } finally {
      surface.dispose()
    }
  } catch {
    if (currentRenderId !== renderId || target !== canvas.value) return
    const context = target.getContext('2d')
    if (!context) return
    target.width = 640
    target.height = 144
    context.clearRect(0, 0, target.width, target.height)
    drawTextRegion(context, props.text || 'Preview', region, props.render)
  }
}

watch(() => [props.text, props.render] as const, renderCanvas, { immediate: true, deep: true })

onBeforeUnmount(() => {
  disposed = true
  if (frame !== undefined) window.cancelAnimationFrame(frame)
})
</script>

<template>
  <canvas
    ref="canvas"
    class="block h-full max-w-full aspect-[40/9] [image-rendering:pixelated]"
    :class="backgroundClass"
  ></canvas>
</template>
