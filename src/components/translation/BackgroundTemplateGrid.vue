<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize, useScroll } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import type { BackgroundTemplate } from '@/domain/resource/types'

const props = withDefaults(
  defineProps<{
    templates: BackgroundTemplate[]
    imageUrls: Record<string, string>
    selectedTemplateId?: string
    referenceCounts?: Record<string, number>
  }>(),
  { referenceCounts: () => ({}) },
)
const emit = defineEmits<{
  select: [id: string]
  upload: [files: File[]]
  rename: [id: string, name: string]
  replace: [id: string, file: File]
  delete: [id: string, fallback?: 'original' | 'blank']
}>()
const { t } = useI18n()

const viewport = ref<HTMLElement>()
const fileInput = ref<HTMLInputElement>()
const replaceInput = ref<HTMLInputElement>()
const previewSize = ref([128])
const dragging = ref(false)
const renameTarget = ref<BackgroundTemplate>()
const renameDraft = ref('')
const deleteTarget = ref<BackgroundTemplate>()
const replacingTemplateId = ref<string>()
const { width, height } = useElementSize(viewport)
const { y } = useScroll(viewport)

const gap = 8
const padding = 12
const labelHeight = 28
const overscanRows = 2
const thumbnailSize = computed(() => previewSize.value[0] ?? 128)
const itemHeight = computed(() => thumbnailSize.value + labelHeight)
const viewportWidth = computed(() => width.value || 720)
const viewportHeight = computed(() => height.value || 420)
const columns = computed(() =>
  Math.max(1, Math.floor((viewportWidth.value - padding * 2 + gap) / (thumbnailSize.value + gap))),
)
const rowCount = computed(() => Math.ceil(props.templates.length / columns.value))
const rowHeight = computed(() => itemHeight.value + gap)
const startRow = computed(() => Math.max(0, Math.floor(y.value / rowHeight.value) - overscanRows))
const endRow = computed(() =>
  Math.min(
    rowCount.value,
    Math.ceil((y.value + viewportHeight.value) / rowHeight.value) + overscanRows,
  ),
)
const visibleTemplates = computed(() =>
  props.templates.slice(startRow.value * columns.value, endRow.value * columns.value),
)
const totalHeight = computed(() => rowCount.value * rowHeight.value + padding * 2)
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columns.value}, ${thumbnailSize.value}px)`,
  transform: `translateY(${padding + startRow.value * rowHeight.value}px)`,
}))
const deleteReferenceCount = computed(() =>
  deleteTarget.value ? (props.referenceCounts[deleteTarget.value.id] ?? 0) : 0,
)

function imageFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter((file) => file.type.startsWith('image/'))
}

function uploadFromInput(event: Event): void {
  const files = imageFiles((event.target as HTMLInputElement).files ?? [])
  if (files.length) emit('upload', files)
  ;(event.target as HTMLInputElement).value = ''
}

function beginDrop(event: DragEvent): void {
  if (event.dataTransfer?.types.includes('Files')) dragging.value = true
}

function endDrop(): void {
  dragging.value = false
}

function dropFiles(event: DragEvent): void {
  dragging.value = false
  const files = imageFiles(event.dataTransfer?.files ?? [])
  if (files.length) emit('upload', files)
}

function openRename(template: BackgroundTemplate): void {
  renameTarget.value = template
  renameDraft.value = template.name
}

function saveRename(): void {
  const target = renameTarget.value
  if (!target || !renameDraft.value.trim()) return
  emit('rename', target.id, renameDraft.value.trim())
  renameTarget.value = undefined
}

function openReplacement(id: string): void {
  replacingTemplateId.value = id
  replaceInput.value?.click()
}

function replaceFromInput(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file?.type.startsWith('image/') && replacingTemplateId.value) {
    emit('replace', replacingTemplateId.value, file)
  }
  replacingTemplateId.value = undefined
  ;(event.target as HTMLInputElement).value = ''
}

function confirmDelete(fallback?: 'original' | 'blank'): void {
  const target = deleteTarget.value
  if (!target) return
  emit('delete', target.id, fallback)
  deleteTarget.value = undefined
}
</script>

<template>
  <section class="flex min-h-[26rem] flex-1 flex-col" data-testid="background-template-grid">
    <header class="flex shrink-0 items-center gap-3 border-b px-1 pb-3">
      <p class="text-xs text-muted-foreground">
        {{ t('backgroundTemplateGrid.count', { count: templates.length }) }}
      </p>
      <label class="ml-auto flex w-56 items-center gap-3 text-xs text-muted-foreground">
        <span class="shrink-0">{{ t('backgroundTemplateGrid.previewSize') }}</span>
        <Slider
          v-model="previewSize"
          :min="72"
          :max="240"
          :step="8"
          :aria-label="t('backgroundTemplateGrid.previewSize')"
        />
        <span class="w-10 shrink-0 text-right tabular-nums">{{ thumbnailSize }} px</span>
      </label>
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept="image/*"
        multiple
        @change="uploadFromInput"
      />
      <input
        ref="replaceInput"
        class="sr-only"
        type="file"
        accept="image/*"
        @change="replaceFromInput"
      />
      <Button variant="outline" size="sm" @click="fileInput?.click()">
        {{ t('backgroundTemplateGrid.upload') }}
      </Button>
    </header>
    <div
      ref="viewport"
      class="min-h-0 flex-1 overflow-auto rounded-b border border-t-0"
      :class="{ 'bg-accent/40 ring-2 ring-ring/50': dragging }"
      data-testid="background-template-grid-viewport"
      @dragenter.prevent="beginDrop"
      @dragover.prevent="beginDrop"
      @dragleave.prevent="endDrop"
      @drop.prevent="dropFiles"
    >
      <div
        v-if="templates.length === 0"
        class="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground"
      >
        {{ t('backgroundTemplateGrid.empty') }}
      </div>
      <div v-else class="relative" :style="{ height: `${totalHeight}px` }">
        <div class="absolute grid justify-center gap-2" :style="gridStyle">
          <ContextMenu v-for="template in visibleTemplates" :key="template.id">
            <ContextMenuTrigger as-child>
              <article :style="{ width: `${thumbnailSize}px` }">
                <button
                  type="button"
                  class="flex w-full flex-col gap-1 rounded-md p-1 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
                  :class="{
                    'bg-accent ring-2 ring-primary': template.id === selectedTemplateId,
                  }"
                  :aria-label="template.name"
                  :aria-pressed="template.id === selectedTemplateId"
                  data-testid="background-template-grid-item"
                  @click="emit('select', template.id)"
                >
                  <span class="bg-checkerboard flex aspect-square items-center justify-center overflow-hidden rounded border">
                    <img
                      v-if="imageUrls[template.id]"
                      :src="imageUrls[template.id]"
                      :alt="template.name"
                      class="size-full object-contain"
                      loading="lazy"
                    />
                    <span v-else class="text-xs text-muted-foreground">?</span>
                  </span>
                  <span class="truncate px-1 text-xs" :title="template.name">{{ template.name }}</span>
                </button>
              </article>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem @select="openRename(template)">
                {{ t('backgroundTemplateGrid.rename') }}
              </ContextMenuItem>
              <ContextMenuItem @select="openReplacement(template.id)">
                {{ t('backgroundTemplateGrid.replace') }}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" @select="deleteTarget = template">
                {{ t('backgroundTemplateGrid.delete') }}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </div>
    </div>

    <Dialog :open="renameTarget !== undefined" @update:open="(open) => !open && (renameTarget = undefined)">
      <DialogContent class="sm:max-w-md" :show-close-button="false">
        <DialogHeader><DialogTitle>{{ t('backgroundTemplateGrid.renameTitle') }}</DialogTitle></DialogHeader>
        <Input v-model="renameDraft" :aria-label="t('backgroundTemplateGrid.name')" @keyup.enter="saveRename" />
        <DialogFooter>
          <Button variant="outline" @click="renameTarget = undefined">{{ t('common.cancel') }}</Button>
          <Button :disabled="!renameDraft.trim()" @click="saveRename">{{ t('common.save') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog :open="deleteTarget !== undefined" @update:open="(open) => !open && (deleteTarget = undefined)">
      <AlertDialogContent v-if="deleteTarget" class="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('backgroundTemplateGrid.deleteTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="deleteReferenceCount > 0">
              {{ t('backgroundTemplateGrid.deleteInUse', { count: deleteReferenceCount }) }}
              {{ t('backgroundTemplateGrid.replaceRecommended') }}
            </template>
            <template v-else>{{ t('backgroundTemplateGrid.deleteUnused') }}</template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter class="flex-wrap gap-2 sm:justify-end">
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <template v-if="deleteReferenceCount > 0">
            <Button variant="outline" size="sm" @click="confirmDelete('original')">
              {{ t('backgroundTemplateGrid.deleteSetOriginal') }}
            </Button>
            <Button variant="outline" size="sm" @click="confirmDelete('blank')">
              {{ t('backgroundTemplateGrid.deleteSetBlank') }}
            </Button>
          </template>
          <Button v-else variant="outline" size="sm" @click="confirmDelete()">
            {{ t('backgroundTemplateGrid.delete') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
