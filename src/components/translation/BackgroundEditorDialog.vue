<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BackgroundTemplateGrid from '@/components/translation/BackgroundTemplateGrid.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { BackgroundTemplate, SpriteBackground } from '@/domain/resource/types'

const props = defineProps<{
  open: boolean
  type?: 'original' | 'blank' | 'template' | 'sprite'
  backgroundId?: string
  templates: BackgroundTemplate[]
  spriteBackgrounds: SpriteBackground[]
  imageUrls: Record<string, string>
  templateReferenceCounts: Record<string, number>
}>()
const emit = defineEmits<{
  close: []
  save: [type: 'original' | 'blank' | 'template' | 'sprite', backgroundId?: string]
  uploadTemplate: [files: File[]]
  uploadSprite: [file: File]
  renameTemplate: [id: string, name: string]
  replaceTemplate: [id: string, file: File]
  deleteTemplate: [id: string, fallback?: 'original' | 'blank']
}>()
const { t } = useI18n()
const draftType = ref<'original' | 'blank' | 'template' | 'sprite'>('original')
const draftBackgroundId = ref<string>()
const spriteFileInput = ref<HTMLInputElement>()
const choices = ['original', 'blank', 'template', 'sprite'] as const
const canSave = computed(() =>
  draftType.value === 'template' || draftType.value === 'sprite'
    ? draftBackgroundId.value !== undefined
    : true,
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

watch(draftType, () => {
  if (draftType.value === 'original' || draftType.value === 'blank') {
    draftBackgroundId.value = undefined
    return
  }

  const backgrounds = draftType.value === 'template' ? props.templates : props.spriteBackgrounds
  if (!backgrounds.some((background) => background.id === draftBackgroundId.value)) {
    draftBackgroundId.value = undefined
  }
})

function uploadSprite(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file?.type.startsWith('image/')) emit('uploadSprite', file)
  ;(event.target as HTMLInputElement).value = ''
}

function typeLabel(type: (typeof choices)[number]): string {
  return t(`translation.background${type[0]?.toUpperCase()}${type.slice(1)}`)
}
</script>

<template>
  <Dialog :open="open" @update:open="(value) => !value && emit('close')">
    <DialogContent
      class="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-[960px]"
      :show-close-button="false"
    >
      <DialogHeader class="border-b px-5 py-4">
        <DialogTitle>{{ t('translation.backgroundTitle') }}</DialogTitle>
      </DialogHeader>
      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5">
        <div class="flex flex-wrap gap-2" role="radiogroup">
          <label v-for="option in choices" :key="option" class="flex items-center gap-2 text-sm">
            <input v-model="draftType" type="radio" :value="option" />
            {{ typeLabel(option) }}
          </label>
        </div>
        <BackgroundTemplateGrid
          v-if="draftType === 'template'"
          :templates="templates"
          :image-urls="imageUrls"
          :selected-template-id="draftBackgroundId"
          :reference-counts="templateReferenceCounts"
          @select="draftBackgroundId = $event"
          @upload="emit('uploadTemplate', $event)"
          @rename="(id, name) => emit('renameTemplate', id, name)"
          @replace="(id, file) => emit('replaceTemplate', id, file)"
          @delete="(id, fallback) => emit('deleteTemplate', id, fallback)"
        />
        <template v-else-if="draftType === 'sprite'">
          <input
            ref="spriteFileInput"
            class="sr-only"
            type="file"
            accept="image/*"
            @change="uploadSprite"
          />
          <Button class="self-start" variant="outline" @click="spriteFileInput?.click()">
            {{ t('translation.upload') }}
          </Button>
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="background in spriteBackgrounds"
              :key="background.id"
              type="button"
              class="overflow-hidden rounded border p-1 text-left"
              :class="{ 'ring-1 ring-primary': draftBackgroundId === background.id }"
              @click="draftBackgroundId = background.id"
            >
              <img
                :src="imageUrls[background.id]"
                :alt="background.name"
                class="aspect-video w-full object-contain"
              />
              <span class="block truncate px-1 py-1 text-xs">{{ background.name }}</span>
            </button>
          </div>
        </template>
      </div>
      <DialogFooter class="border-t px-5 py-4">
        <Button variant="outline" @click="emit('close')">{{ t('translation.cancel') }}</Button>
        <Button
          :disabled="!canSave"
          @click="
            emit(
              'save',
              draftType,
              draftType === 'template' || draftType === 'sprite' ? draftBackgroundId : undefined,
            )
          "
        >{{ t('common.ok') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
