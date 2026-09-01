<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type ImagePreviewItem = {
  src?: string
  alt?: string
  title?: string
}

const props = withDefaults(
  defineProps<{
    open: boolean
    imageUrl?: string
    alt?: string
    title?: string
    images?: ImagePreviewItem[]
    initialIndex?: number
    mode?: 'list' | 'compare'
    background?: 'transparent' | 'black' | 'white'
  }>(),
  { background: 'transparent', initialIndex: 0, mode: 'list' },
)
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const activeIndex = ref(0)
const images = computed<ImagePreviewItem[]>(() => {
  if (props.images?.length) return props.images
  return props.imageUrl ? [{ src: props.imageUrl, alt: props.alt, title: props.title }] : []
})
const activeImage = computed(() => images.value[activeIndex.value])
const hasMultipleImages = computed(() => images.value.length > 1)
const backgroundClass = computed(() => {
  if (props.background === 'black') return 'bg-black'
  if (props.background === 'white') return 'bg-white'
  return 'bg-checkerboard'
})

function clampIndex(index: number): number {
  return Math.max(0, Math.min(index, Math.max(0, images.value.length - 1)))
}

function selectImage(index: number): void {
  activeIndex.value = clampIndex(index)
}

function previousImage(): void {
  selectImage(activeIndex.value - 1)
}

function nextImage(): void {
  selectImage(activeIndex.value + 1)
}

function handleKeydown(event: KeyboardEvent): void {
  if (!props.open || !hasMultipleImages.value) return
  if (event.key === 'ArrowLeft' && activeIndex.value > 0) {
    event.preventDefault()
    previousImage()
  }
  if (event.key === 'ArrowRight' && activeIndex.value < images.value.length - 1) {
    event.preventDefault()
    nextImage()
  }
}

watch(
  () => [props.open, props.initialIndex] as const,
  ([open]) => {
    if (open) selectImage(props.initialIndex)
  },
  { immediate: true },
)

watch(
  () => images.value.length,
  () => selectImage(activeIndex.value),
)

watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener('keydown', handleKeydown)
    else window.removeEventListener('keydown', handleKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Dialog :open="open" @update:open="(value) => !value && emit('close')">
    <DialogContent
      class="top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-transparent p-3 shadow-none sm:p-12"
      :show-close-button="false"
      @pointerdown.self="emit('close')"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ title ?? activeImage?.title ?? activeImage?.alt ?? t('imagePreview.title') }}</DialogTitle>
      </DialogHeader>
      <Button
        class="fixed top-3 right-3 rounded-full bg-black text-white hover:bg-black/80 sm:top-7 sm:right-7"
        :aria-label="t('imagePreview.close')"
        size="icon"
        @click="emit('close')"
      >
        <X data-icon="inline-start" />
      </Button>
      <div class="relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div
          class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded"
          :class="backgroundClass"
        >
          <slot name="image" :image="activeImage" :index="activeIndex">
            <slot :image="activeImage" :index="activeIndex">
              <img
                v-if="activeImage?.src"
                :src="activeImage.src"
                :alt="activeImage.alt ?? ''"
                class="h-full w-full object-contain"
              />
            </slot>
          </slot>
          <template v-if="hasMultipleImages && mode === 'list'">
            <Button
              class="absolute left-3 top-1/2 -translate-y-1/2"
              :aria-label="t('imagePreview.previous')"
              :disabled="activeIndex === 0"
              size="icon"
              variant="outline"
              @click="previousImage"
            >
              <ChevronLeft data-icon="inline-start" />
            </Button>
            <Button
              class="absolute top-1/2 right-3 -translate-y-1/2"
              :aria-label="t('imagePreview.next')"
              :disabled="activeIndex === images.length - 1"
              size="icon"
              variant="outline"
              @click="nextImage"
            >
              <ChevronRight data-icon="inline-start" />
            </Button>
          </template>
        </div>
        <div
          v-if="hasMultipleImages && mode === 'compare'"
          class="flex justify-center gap-2"
          role="tablist"
        >
          <Button
            v-for="(image, index) in images"
            :key="image.title ?? image.alt ?? index"
            :aria-selected="activeIndex === index"
            :variant="activeIndex === index ? 'default' : 'outline'"
            role="tab"
            size="sm"
            @click="selectImage(index)"
          >
            {{ image.title ?? image.alt ?? index + 1 }}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
