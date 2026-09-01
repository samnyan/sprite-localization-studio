<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useElementSize, useScroll } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { Slider } from '@/components/ui/slider'
import type { PreviewBackground } from '@/app/stores/workspace'
import type { Sprite } from '@/domain/sprite/types'
import type { SpriteTable } from '@/domain/sprite-table/types'
import {
  getLogicalSpriteSize,
  getStoredToLogicalTransform,
} from '@/infrastructure/image/spriteGeometry'

const props = withDefaults(
  defineProps<{
    spriteTable: SpriteTable
    textureUrls: Record<string, string>
    selectedSpriteId?: string
    previewBackground?: PreviewBackground
  }>(),
  { previewBackground: 'transparent' },
)
const emit = defineEmits<{ select: [spriteId: string]; open: [spriteId: string] }>()
const { t } = useI18n()

const viewport = ref<HTMLElement>()
const previewSize = ref([112])
const thumbnailCanvases = new Map<string, HTMLCanvasElement>()
const imagePromises = new Map<string, Promise<HTMLImageElement>>()
const { width, height } = useElementSize(viewport)
const { y } = useScroll(viewport)

const gap = 8
const padding = 8
const labelHeight = 32
const overscanRows = 2
const thumbnailSize = computed(() => previewSize.value[0] ?? 112)
const itemHeight = computed(() => thumbnailSize.value + labelHeight)
const viewportWidth = computed(() => width.value || 640)
const viewportHeight = computed(() => height.value || 480)
const columns = computed(() =>
  Math.max(1, Math.floor((viewportWidth.value - padding * 2 + gap) / (thumbnailSize.value + gap))),
)
const rowCount = computed(() => Math.ceil(props.spriteTable.sprites.length / columns.value))
const rowHeight = computed(() => itemHeight.value + gap)
const startRow = computed(() =>
  Math.max(0, Math.floor(y.value / rowHeight.value) - overscanRows),
)
const endRow = computed(() =>
  Math.min(
    rowCount.value,
    Math.ceil((y.value + viewportHeight.value) / rowHeight.value) + overscanRows,
  ),
)
const visibleSprites = computed(() =>
  props.spriteTable.sprites.slice(startRow.value * columns.value, endRow.value * columns.value),
)
const totalHeight = computed(() => rowCount.value * rowHeight.value + padding * 2)
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columns.value}, ${thumbnailSize.value}px)`,
  transform: `translateY(${padding + startRow.value * rowHeight.value}px)`,
}))
const backgroundClass = computed(() => {
  if (props.previewBackground === 'black') return 'bg-black'
  if (props.previewBackground === 'white') return 'bg-white'
  return 'bg-checkerboard'
})

function imageFor(url: string): Promise<HTMLImageElement> {
  const existing = imagePromises.get(url)
  if (existing) return existing

  const loading = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('sprite-thumbnail-image-load-failed'))
    image.src = url
  })
  imagePromises.set(url, loading)
  return loading
}

function setThumbnailCanvas(spriteId: string, element: unknown): void {
  if (element instanceof HTMLCanvasElement) thumbnailCanvases.set(spriteId, element)
  else thumbnailCanvases.delete(spriteId)
}

async function drawThumbnail(sprite: Sprite): Promise<void> {
  const canvas = thumbnailCanvases.get(sprite.id)
  const url = props.textureUrls[sprite.textureId]
  if (!canvas || !url) return

  try {
    const image = await imageFor(url)
    if (thumbnailCanvases.get(sprite.id) !== canvas) return
    const size = thumbnailSize.value
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(size * ratio))
    canvas.height = Math.max(1, Math.round(size * ratio))
    const context = canvas.getContext('2d')
    if (!context) return

    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, size, size)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const logicalSize = getLogicalSpriteSize(sprite)
    if (logicalSize.width <= 0 || logicalSize.height <= 0) return

    const scale = Math.min((size - 12) / logicalSize.width, (size - 12) / logicalSize.height)
    context.save()
    context.translate(
      (size - logicalSize.width * scale) / 2,
      (size - logicalSize.height * scale) / 2,
    )
    context.scale(scale, scale)
    context.translate(sprite.trimOffset?.x ?? 0, sprite.trimOffset?.y ?? 0)
    const transform = getStoredToLogicalTransform(sprite)
    context.transform(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f,
    )
    context.drawImage(
      image,
      sprite.frame.x,
      sprite.frame.y,
      sprite.frame.width,
      sprite.frame.height,
      0,
      0,
      sprite.frame.width,
      sprite.frame.height,
    )
    context.restore()
  } catch {
    return
  }
}

async function drawVisibleThumbnails(): Promise<void> {
  await nextTick()
  await Promise.all(visibleSprites.value.map((sprite) => drawThumbnail(sprite)))
}

watch(
  [visibleSprites, thumbnailSize, () => props.textureUrls],
  () => void drawVisibleThumbnails(),
  { deep: true, flush: 'post', immediate: true },
)
</script>

<template>
  <section class="flex min-h-0 w-full flex-1 self-stretch flex-col" data-testid="sprite-table-grid">
    <header class="flex shrink-0 items-center gap-4 border-b bg-card px-4 py-2">
      <div class="min-w-0">
        <h1 class="truncate text-sm font-semibold">{{ spriteTable.name }}</h1>
        <p class="text-xs text-muted-foreground">
          {{ t('spriteGrid.spriteCount', { count: spriteTable.sprites.length }) }}
        </p>
      </div>
      <label class="ml-auto flex w-56 items-center gap-3 text-xs text-muted-foreground">
        <span class="shrink-0">{{ t('spriteGrid.previewSize') }}</span>
        <Slider
          v-model="previewSize"
          :min="72"
          :max="240"
          :step="8"
          :aria-label="t('spriteGrid.previewSize')"
        />
        <span class="w-10 shrink-0 text-right tabular-nums">{{ thumbnailSize }} px</span>
      </label>
    </header>
    <div
      ref="viewport"
      class="min-h-0 flex-1 overflow-auto"
      data-testid="sprite-grid-viewport"
    >
      <div v-if="spriteTable.sprites.length === 0" class="p-6 text-center text-sm text-muted-foreground">
        {{ t('spriteGrid.empty') }}
      </div>
      <div v-else class="relative" :style="{ height: `${totalHeight}px` }">
        <div class="absolute grid justify-center gap-2" :style="gridStyle">
          <button
            v-for="sprite in visibleSprites"
            :key="sprite.id"
            type="button"
            class="flex flex-col gap-1 rounded-md p-1 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
            :class="{ 'bg-accent ring-2 ring-primary': sprite.id === selectedSpriteId }"
            :style="{ width: `${thumbnailSize}px` }"
            :aria-label="sprite.name"
            :aria-pressed="sprite.id === selectedSpriteId"
            data-testid="sprite-grid-item"
            @click="emit('select', sprite.id)"
            @dblclick="emit('open', sprite.id)"
          >
            <span
              class="flex aspect-square items-center justify-center overflow-hidden rounded border"
              :class="backgroundClass"
              data-testid="sprite-grid-preview-background"
            >
              <canvas
                :ref="(element) => setThumbnailCanvas(sprite.id, element)"
                class="block size-full [image-rendering:auto]"
              ></canvas>
            </span>
            <span class="truncate text-xs" :title="sprite.name">{{ sprite.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
