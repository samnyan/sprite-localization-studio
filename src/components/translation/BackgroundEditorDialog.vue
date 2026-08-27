<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ImageResource } from '@/domain/resource/types'

const props = defineProps<{
  open: boolean
  type?: 'original' | 'blank' | 'template'
  backgroundId?: string
  templates: ImageResource[]
  imageUrls: Record<string, string>
}>()
const emit = defineEmits<{
  close: []
  save: [type: 'original' | 'blank' | 'template', backgroundId?: string]
  upload: [file: File]
}>()
const { t } = useI18n()
const draftType = ref<'original' | 'blank' | 'template'>('original')
const draftBackgroundId = ref<string>()
const fileInput = ref<HTMLInputElement>()
const canSave = computed(
  () => draftType.value !== 'template' || draftBackgroundId.value !== undefined,
)

watch(
  () => [props.open, props.type, props.backgroundId] as const,
  () => {
    if (!props.open) return
    draftType.value = props.type ?? (props.backgroundId ? 'template' : 'original')
    draftBackgroundId.value = props.backgroundId
  },
  { immediate: true },
)

function upload(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) emit('upload', file)
  ;(event.target as HTMLInputElement).value = ''
}

function typeLabel(type: 'original' | 'blank' | 'template'): string {
  return t(`translation.background${type[0]?.toUpperCase()}${type.slice(1)}`)
}
</script>

<template>
  <Dialog :open="open" @update:open="(value) => !value && emit('close')">
    <DialogContent class="max-w-xl" :show-close-button="false">
      <DialogHeader
        ><DialogTitle>{{ t('translation.backgroundTitle') }}</DialogTitle></DialogHeader
      >
      <div class="flex flex-col gap-4">
        <div class="grid gap-2" role="radiogroup">
          <label
            v-for="option in ['original', 'blank', 'template'] as const"
            :key="option"
            class="flex items-center gap-2 text-sm"
            ><input v-model="draftType" type="radio" :value="option" />{{
              typeLabel(option)
            }}</label
          >
        </div>
        <template v-if="draftType === 'template'">
          <input ref="fileInput" class="sr-only" type="file" accept="image/*" @change="upload" />
          <Button variant="outline" class="w-fit" @click="fileInput?.click()">{{
            t('translation.upload')
          }}</Button>
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="template in templates"
              :key="template.id"
              type="button"
              class="overflow-hidden rounded border p-1"
              :class="{ 'border-primary ring-1 ring-primary': draftBackgroundId === template.id }"
              @click="draftBackgroundId = template.id"
            >
              <img
                :src="imageUrls[template.id]"
                :alt="template.name"
                class="aspect-video w-full object-contain"
              />
              <span class="block truncate px-1 py-1 text-xs">{{ template.name }}</span>
            </button>
          </div>
        </template>
      </div>
      <DialogFooter
        ><Button variant="outline" @click="emit('close')">{{ t('translation.cancel') }}</Button
        ><Button
          :disabled="!canSave"
          @click="emit('save', draftType, draftType === 'template' ? draftBackgroundId : undefined)"
          >{{ t('common.ok') }}</Button
        ></DialogFooter
      >
    </DialogContent>
  </Dialog>
</template>
