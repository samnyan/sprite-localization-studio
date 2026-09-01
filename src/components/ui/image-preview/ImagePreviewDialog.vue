<script setup lang="ts">
import { computed } from 'vue'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = withDefaults(
  defineProps<{
    open: boolean
    imageUrl?: string
    alt?: string
    title?: string
    background?: 'transparent' | 'black' | 'white'
  }>(),
  { background: 'transparent' },
)
const emit = defineEmits<{ close: [] }>()

const backgroundClass = computed(() => {
  if (props.background === 'black') return 'bg-black'
  if (props.background === 'white') return 'bg-white'
  return 'bg-checkerboard'
})
</script>

<template>
  <Dialog :open="open" @update:open="(value) => !value && emit('close')">
    <DialogContent
      class="flex h-[90vh] max-w-[calc(100vw-2rem)] flex-col gap-0 p-3 sm:max-w-[calc(100vw-4rem)]"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ title ?? alt ?? 'Image preview' }}</DialogTitle>
      </DialogHeader>
      <div
        class="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded"
        :class="backgroundClass"
      >
        <slot>
          <img
            v-if="imageUrl"
            :src="imageUrl"
            :alt="alt ?? ''"
            class="h-full w-full object-contain"
          />
        </slot>
      </div>
    </DialogContent>
  </Dialog>
</template>
