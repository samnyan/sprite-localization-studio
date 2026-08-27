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
import { Input } from '@/components/ui/input'
import type { BackgroundTemplate, SpriteBackground } from '@/domain/resource/types'

const props = defineProps<{
  open: boolean
  type?: 'original' | 'blank' | 'template' | 'sprite'
  backgroundId?: string
  templates: BackgroundTemplate[]
  spriteBackgrounds: SpriteBackground[]
  imageUrls: Record<string, string>
}>()
const emit = defineEmits<{
  close: []
  save: [type: 'original' | 'blank' | 'template' | 'sprite', backgroundId?: string]
  upload: [scope: 'template' | 'sprite', file: File]
  renameTemplate: [id: string, name: string]
  replaceTemplate: [id: string, file: File]
  deleteTemplate: [id: string]
}>()
const { t } = useI18n()
const draftType = ref<'original' | 'blank' | 'template' | 'sprite'>('original')
const draftBackgroundId = ref<string>()
const fileInput = ref<HTMLInputElement>()
const replaceInput = ref<HTMLInputElement>()
const replacingTemplateId = ref<string>()
const managingTemplates = ref(false)
const choices = ['original', 'blank', 'template', 'sprite'] as const
const selectedBackgrounds = computed(() =>
  draftType.value === 'template'
    ? props.templates
    : draftType.value === 'sprite'
      ? props.spriteBackgrounds
      : [],
)
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
  if (draftType.value !== 'template' && draftType.value !== 'sprite') {
    draftBackgroundId.value = undefined
    return
  }

  if (!selectedBackgrounds.value.some((background) => background.id === draftBackgroundId.value)) {
    draftBackgroundId.value = undefined
  }
})

function upload(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file && (draftType.value === 'template' || draftType.value === 'sprite')) {
    emit('upload', draftType.value, file)
  }
  ;(event.target as HTMLInputElement).value = ''
}

function replaceTemplate(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file && replacingTemplateId.value) emit('replaceTemplate', replacingTemplateId.value, file)
  replacingTemplateId.value = undefined
  ;(event.target as HTMLInputElement).value = ''
}

function openTemplateReplacement(id: string): void {
  replacingTemplateId.value = id
  replaceInput.value?.click()
}

function typeLabel(type: (typeof choices)[number]): string {
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
          <label v-for="option in choices" :key="option" class="flex items-center gap-2 text-sm"
            ><input v-model="draftType" type="radio" :value="option" />{{
              typeLabel(option)
            }}</label
          >
        </div>
        <template v-if="draftType === 'template' || draftType === 'sprite'">
          <input ref="fileInput" class="sr-only" type="file" accept="image/*" @change="upload" />
          <input
            ref="replaceInput"
            class="sr-only"
            type="file"
            accept="image/*"
            @change="replaceTemplate"
          />
          <div class="flex gap-2">
            <Button variant="outline" @click="fileInput?.click()">{{
              t('translation.upload')
            }}</Button>
            <Button
              v-if="draftType === 'template'"
              variant="outline"
              @click="managingTemplates = !managingTemplates"
            >
              {{ t('translation.manageTemplates') }}
            </Button>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <article
              v-for="background in selectedBackgrounds"
              :key="background.id"
              class="overflow-hidden rounded border p-1"
            >
              <button
                type="button"
                class="block w-full"
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
              <div
                v-if="managingTemplates && draftType === 'template'"
                class="flex gap-1 px-1 pb-1"
              >
                <Input
                  :model-value="background.name"
                  class="h-7 text-xs"
                  @blur="
                    emit('renameTemplate', background.id, ($event.target as HTMLInputElement).value)
                  "
                />
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 px-2 text-xs"
                  @click="openTemplateReplacement(background.id)"
                >
                  {{ t('translation.replace') }}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 px-2 text-xs"
                  @click="emit('deleteTemplate', background.id)"
                >
                  {{ t('translation.delete') }}
                </Button>
              </div>
            </article>
          </div>
        </template>
      </div>
      <DialogFooter
        ><Button variant="outline" @click="emit('close')">{{ t('translation.cancel') }}</Button
        ><Button
          :disabled="!canSave"
          @click="
            emit(
              'save',
              draftType,
              draftType === 'template' || draftType === 'sprite' ? draftBackgroundId : undefined,
            )
          "
          >{{ t('common.ok') }}</Button
        ></DialogFooter
      >
    </DialogContent>
  </Dialog>
</template>
