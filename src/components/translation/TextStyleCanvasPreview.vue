<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { drawTextRegion } from '@/infrastructure/image/textRenderer'
import type { TextRenderConfig } from '@/domain/text-region/types'
import type { PreviewBackground } from '@/app/stores/workspace'

const props = withDefaults(
  defineProps<{ text: string; render: TextRenderConfig; previewBackground?: PreviewBackground }>(),
  { previewBackground: 'transparent' },
)
const canvas = ref<HTMLCanvasElement>()
const backgroundClass = computed(() => {
  if (props.previewBackground === 'black') return 'bg-black'
  if (props.previewBackground === 'white') return 'bg-white'
  return 'bg-checkerboard'
})

function renderCanvas(): void {
  void nextTick(() => {
    const context = canvas.value?.getContext('2d')
    if (!context || !canvas.value) return
    canvas.value.width = 640
    canvas.value.height = 144
    context.clearRect(0, 0, canvas.value.width, canvas.value.height)
    drawTextRegion(
      context,
      props.text || 'Preview',
      {
        id: 'preview',
        rect: { x: 20, y: 20, width: 600, height: 104 },
        rotation: 0,
        translationKey: 'preview',
      },
      props.render,
    )
  })
}

watch(() => [props.text, props.render] as const, renderCanvas, { immediate: true, deep: true })
</script>

<template>
  <canvas
    ref="canvas"
    class="block h-full max-w-full aspect-[40/9] [image-rendering:pixelated]"
    :class="backgroundClass"
  ></canvas>
</template>
