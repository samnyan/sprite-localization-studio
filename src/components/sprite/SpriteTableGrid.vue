<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useElementSize, useScroll } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { LoaderCircle } from '@lucide/vue'

import { Slider } from '@/components/ui/slider'
import type { PreviewBackground } from '@/app/stores/workspace'
import type { Sprite } from '@/domain/sprite/types'
import type { SpriteTable } from '@/domain/sprite-table/types'
import {
  getLogicalSpriteSize,
  getStoredToLogicalTransform,
} from '@/infrastructure/image/spriteGeometry'

interface SpriteSelectionModifiers {
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

const props = withDefaults(
  defineProps<{
    spriteTable: SpriteTable
    textureUrls: Record<string, string>
    loadTexture?: (textureId: string) => Promise<string | undefined>
    selectedSpriteId?: string
    selectedSpriteIds?: ReadonlySet<string>
    batchDisabled?: boolean
    previewBackground?: PreviewBackground
    visibleSpriteIds?: Set<string>
  }>(),
  { previewBackground: 'transparent' },
)
const emit = defineEmits<{
  select: [spriteId: string, modifiers: SpriteSelectionModifiers]
  open: [spriteId: string]
  toggleSelection: [spriteId: string]
  batchTranslate: []
  clearSelection: []
}>()
const { t } = useI18n()

const viewport = ref<HTMLElement>()
const previewSize = ref([112])
const thumbnailCanvases = new Map<string, HTMLCanvasElement>()
const imagePromises = new Map<string, Promise<HTMLImageElement>>()
const thumbnailStates = ref<Record<string, 'loading' | 'loaded' | 'error'>>({})
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
const visibleSprites = computed(() =>
  props.spriteTable.sprites.filter(
    (sprite) => !props.visibleSpriteIds || props.visibleSpriteIds.has(sprite.id),
  ),
)

const rowCount = computed(() => Math.ceil(visibleSprites.value.length / columns.value))
const rowHeight = computed(() => itemHeight.value + gap)
const startRow = computed(() => Math.max(0, Math.floor(y.value / rowHeight.value) - overscanRows))
const endRow = computed(() =>
  Math.min(
    rowCount.value,
    Math.ceil((y.value + viewportHeight.value) / rowHeight.value) + overscanRows,
  ),
)
const virtualSprites = computed(() =>
  visibleSprites.value.slice(startRow.value * columns.value, endRow.value * columns.value),
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
const selectedSpriteCount = computed(() => props.selectedSpriteIds?.size ?? 0)

function displaySpriteName(sprite: Sprite): string {
  return sprite.name.replace(/\\/g, '/').split('/').pop() || sprite.name
}

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

function setThumbnailState(spriteId: string, state: 'loading' | 'loaded' | 'error'): void {
  thumbnailStates.value = { ...thumbnailStates.value, [spriteId]: state }
}

async function drawThumbnail(sprite: Sprite): Promise<void> {
  setThumbnailState(sprite.id, 'loading')

  try {
    const url = props.textureUrls[sprite.textureId] ?? (await props.loadTexture?.(sprite.textureId))
    if (!url) {
      setThumbnailState(sprite.id, 'error')
      return
    }
    const image = await imageFor(url)
    setThumbnailState(sprite.id, 'loaded')
    await nextTick()
    const canvas = thumbnailCanvases.get(sprite.id)
    if (!canvas) return
    const size = thumbnailSize.value
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(size * ratio))
    canvas.height = Math.max(1, Math.round(size * ratio))
    const context = canvas.getContext('2d')
    if (!context) {
      setThumbnailState(sprite.id, 'error')
      return
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, size, size)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const logicalSize = getLogicalSpriteSize(sprite)
    if (logicalSize.width <= 0 || logicalSize.height <= 0) {
      setThumbnailState(sprite.id, 'error')
      return
    }

    const scale = Math.min((size - 12) / logicalSize.width, (size - 12) / logicalSize.height)
    context.save()
    context.translate(
      (size - logicalSize.width * scale) / 2,
      (size - logicalSize.height * scale) / 2,
    )
    context.scale(scale, scale)
    context.translate(sprite.trimOffset?.x ?? 0, sprite.trimOffset?.y ?? 0)
    const transform = getStoredToLogicalTransform(sprite)
    context.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f)
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
    setThumbnailState(sprite.id, 'error')
  }
}

async function drawVisibleThumbnails(): Promise<void> {
  await nextTick()
  await Promise.all(virtualSprites.value.map((sprite) => drawThumbnail(sprite)))
}

watch(
  [virtualSprites, thumbnailSize, () => props.textureUrls],
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
          {{ t('spriteGrid.spriteCount', { count: visibleSprites.length }) }}
        </p>
      </div>
      <div v-if="selectedSpriteCount > 0" class="flex shrink-0 items-center gap-2 text-xs">
        <span class="text-muted-foreground">
          {{ t('spriteGrid.selectedCount', { count: selectedSpriteCount }) }}
        </span>
        <button
          type="button"
          class="rounded border px-2 py-1 font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="batchDisabled || selectedSpriteCount === 0"
          @click="emit('batchTranslate')"
        >
          {{ t('spriteGrid.batchTranslate') }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-muted-foreground hover:bg-accent"
          :aria-label="t('spriteGrid.clearSelection')"
          :title="t('spriteGrid.clearSelection')"
          @click="emit('clearSelection')"
        >
          {{ t('spriteGrid.clearSelection') }}
        </button>
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
    <div ref="viewport" class="min-h-0 flex-1 overflow-auto" data-testid="sprite-grid-viewport">
      <div v-if="visibleSprites.length === 0" class="p-6 text-center text-sm text-muted-foreground">
        {{ t('spriteGrid.empty') }}
      </div>
      <div v-else class="relative" :style="{ height: `${totalHeight}px` }">
        <div class="absolute grid justify-center gap-2" :style="gridStyle">
          <div v-for="sprite in virtualSprites" :key="sprite.id" class="relative">
            <button
              type="button"
              class="flex flex-col gap-1 rounded-md p-1 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
              :class="{ 'bg-accent ring-2 ring-primary': sprite.id === selectedSpriteId }"
              :style="{ width: `${thumbnailSize}px` }"
              :aria-label="sprite.name"
              :aria-pressed="sprite.id === selectedSpriteId"
              data-testid="sprite-grid-item"
              @click="
                emit('select', sprite.id, {
                  ctrlKey: $event.ctrlKey,
                  metaKey: $event.metaKey,
                  shiftKey: $event.shiftKey,
                })
              "
              @dblclick="emit('open', sprite.id)"
            >
              <span
                class="flex aspect-square items-center justify-center overflow-hidden rounded border"
                :class="backgroundClass"
                data-testid="sprite-grid-preview-background"
              >
                <LoaderCircle
                  v-if="thumbnailStates[sprite.id] === 'loading'"
                  class="size-5 animate-spin text-muted-foreground"
                  data-testid="sprite-grid-thumbnail-loading"
                  aria-hidden="true"
                />
                <canvas
                  v-else-if="thumbnailStates[sprite.id] === 'loaded'"
                  :ref="(element) => setThumbnailCanvas(sprite.id, element)"
                  class="block size-full [image-rendering:auto]"
                ></canvas>
              </span>
              <span class="truncate text-xs" :title="sprite.name">{{
                displaySpriteName(sprite)
              }}</span>
            </button>
            <input
              type="checkbox"
              class="absolute right-2 top-2 size-4 accent-primary"
              :checked="selectedSpriteIds?.has(sprite.id)"
              :disabled="batchDisabled"
              :aria-label="t('spriteGrid.selectSprite', { name: sprite.name })"
              data-testid="sprite-grid-selection"
              @click.stop
              @change.stop="emit('toggleSelection', sprite.id)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
