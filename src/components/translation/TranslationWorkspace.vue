<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkspaceStore } from '@/app/stores/workspace'
import { showAlert } from '@/app/services/alertDialog'
import TranslationSpritePreview from '@/components/translation/TranslationSpritePreview.vue'
import TextStyleEditorDialog from '@/components/translation/TextStyleEditorDialog.vue'
import BackgroundEditorDialog from '@/components/translation/BackgroundEditorDialog.vue'
import { Button } from '@/components/ui/button'
import type { TextRenderConfig } from '@/domain/text-region/types'
import { textStyleTemplates } from '@/domain/text-region/styleTemplates'

const workspace = useWorkspaceStore()
const { t } = useI18n()
const selectedSpriteTable = computed(() => workspace.selectedSpriteTable)
const editingStyle = ref<{
  spriteId: string
  regionId: string
  text: string
  render?: TextRenderConfig
  styleId?: string
}>()
const editingBackground = ref<{
  spriteId: string
  type?: 'original' | 'blank' | 'template' | 'sprite'
  backgroundId?: string
}>()
const columnRatios = ref([1.25, 1, 1, 1.25, 1])
let resizingColumn: number | undefined
let resizeStartX = 0
let resizeStartRatios: number[] = []

const tableStyle = computed(() => ({
  gridTemplateColumns: columnRatios.value.map((ratio) => `minmax(0, ${ratio}fr)`).join(' '),
}))
const translationRows = computed(() => {
  const spriteTable = selectedSpriteTable.value
  const translations = workspace.project?.translations ?? []
  if (!spriteTable) return []

  return spriteTable.sprites.flatMap((sprite) => {
    const translation = translations.find(
      (item) => item.spriteTableId === spriteTable.id && item.spriteId === sprite.id,
    )
    const texture = spriteTable.textures.find((item) => item.id === sprite.textureId)
    const imageUrl = texture ? workspace.textureImageUrls[spriteTable.id]?.[texture.id] : undefined
    return translation && texture && imageUrl ? [{ sprite, translation, texture, imageUrl }] : []
  })
})

function backgroundUrl(backgroundId?: string): string | undefined {
  return backgroundId ? workspace.backgroundImageUrls[backgroundId] : undefined
}

function styleName(styleId?: string): string {
  return textStyleTemplates.find((template) => template.id === styleId)?.name ?? t('style.custom')
}

function startResize(index: number, event: PointerEvent): void {
  resizingColumn = index
  resizeStartX = event.clientX
  resizeStartRatios = [...columnRatios.value]
  window.addEventListener('pointermove', resizeColumn)
  window.addEventListener('pointerup', finishResize)
}

function resizeColumn(event: PointerEvent): void {
  if (resizingColumn === undefined) return
  const next = resizingColumn + 1
  if (next >= resizeStartRatios.length) return
  const delta = (event.clientX - resizeStartX) / 320
  const left = Math.max(0.5, (resizeStartRatios[resizingColumn] ?? 1) + delta)
  const right = Math.max(0.5, (resizeStartRatios[next] ?? 1) - delta)
  columnRatios.value = resizeStartRatios.map((ratio, index) =>
    index === resizingColumn ? left : index === next ? right : ratio,
  )
}

function finishResize(): void {
  resizingColumn = undefined
  window.removeEventListener('pointermove', resizeColumn)
  window.removeEventListener('pointerup', finishResize)
}

function updateText(
  spriteId: string,
  regionId: string,
  field: 'sourceText' | 'translatedText',
  event: Event,
): void {
  if (!selectedSpriteTable.value) return
  workspace.updateTranslationText(
    selectedSpriteTable.value.id,
    spriteId,
    regionId,
    field,
    (event.target as HTMLTextAreaElement).value,
  )
}

function openStyleEditor(
  spriteId: string,
  regionId: string,
  text: string,
  render?: TextRenderConfig,
  styleId?: string,
): void {
  editingStyle.value = { spriteId, regionId, text, render, styleId }
}

function saveStyle(render: TextRenderConfig, styleId?: string): void {
  if (!selectedSpriteTable.value || !editingStyle.value) return
  const editing = editingStyle.value
  workspace.updateTranslationRegion(
    selectedSpriteTable.value.id,
    editing.spriteId,
    editing.regionId,
    { render, styleId },
  )
  editingStyle.value = undefined
}

function saveBackground(
  type: 'original' | 'blank' | 'template' | 'sprite',
  backgroundId?: string,
): void {
  if (!selectedSpriteTable.value || !editingBackground.value) return
  if (
    workspace.setSpriteTranslationBackground(
      selectedSpriteTable.value.id,
      editingBackground.value.spriteId,
      backgroundId,
      type,
    )
  ) {
    editingBackground.value = undefined
  }
}

async function uploadBackground(scope: 'template' | 'sprite', file: File): Promise<void> {
  if (!selectedSpriteTable.value || !editingBackground.value) return
  const spriteTableId = selectedSpriteTable.value.id
  const spriteId = editingBackground.value.spriteId
  const backgroundId =
    scope === 'template'
      ? await workspace.addBackgroundTemplate(file)
      : await workspace.addSpriteBackground(spriteTableId, spriteId, file)
  if (
    backgroundId &&
    editingBackground.value?.spriteId === spriteId &&
    selectedSpriteTable.value?.id === spriteTableId
  ) {
    editingBackground.value = { ...editingBackground.value, type: scope, backgroundId }
  }
}

function renameTemplate(id: string, name: string): void {
  workspace.renameBackgroundTemplate(id, name)
}

async function replaceTemplate(id: string, file: File): Promise<void> {
  await workspace.replaceBackgroundTemplate(id, file)
}

async function deleteTemplate(id: string): Promise<void> {
  const references = workspace.backgroundTemplateReferenceCount(id)
  if (references > 0) {
    await showAlert({
      title: t('translation.templateInUseTitle'),
      message: t('translation.templateInUse', { count: references }),
      confirmLabel: t('common.ok'),
    })
    return
  }
  await workspace.deleteBackgroundTemplate(id)
}

onUnmounted(finishResize)
</script>

<template>
  <section class="flex min-w-0 flex-1 flex-col overflow-hidden bg-workspace">
    <div
      v-if="!workspace.project"
      class="flex h-full items-center justify-center text-sm text-muted-foreground"
    >
      {{ t('workspace.emptyTitle') }}
    </div>
    <div
      v-else-if="!selectedSpriteTable"
      class="flex h-full items-center justify-center text-sm text-muted-foreground"
    >
      {{ t('translation.selectManifest') }}
    </div>
    <template v-else>
      <div class="min-h-0 flex-1 overflow-auto">
        <div class="sticky top-0 z-20 min-w-max border-b bg-background">
          <div
            class="grid text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            :style="tableStyle"
          >
            <div
              v-for="(label, index) in [
                t('translation.originalSprite'),
                t('translation.sourceText'),
                t('translation.translatedText'),
                t('translation.output'),
                t('translation.style'),
              ]"
              :key="label"
              class="relative px-3 py-2"
            >
              {{ label }}
              <button
                v-if="index < columnRatios.length - 1"
                type="button"
                class="absolute top-0 right-[-3px] z-10 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
                :aria-label="`${label} resize`"
                @pointerdown.prevent="startResize(index, $event)"
              ></button>
            </div>
          </div>
        </div>
        <div
          v-if="translationRows.length === 0"
          class="p-6 text-center text-sm text-muted-foreground"
        >
          {{ t('translation.noSprites') }}
        </div>
        <template v-else>
          <article
            v-for="row in translationRows"
            :key="row.sprite.id"
            class="grid min-w-[900px] border-b bg-card last:border-b-0"
            :style="tableStyle"
          >
            <div class="p-3">
              <TranslationSpritePreview
                :image-url="row.imageUrl"
                :texture-size="row.texture.size"
                :sprite="row.sprite"
                :preview-background="workspace.previewBackground"
              />
            </div>
            <div class="space-y-2 p-3">
              <textarea
                v-for="region in row.translation.textRegions"
                :key="region.id"
                class="min-h-16 w-full resize-y rounded border bg-background px-2 py-1.5 text-xs"
                :aria-label="t('translation.sourceText')"
                :value="region.sourceText ?? ''"
                @input="updateText(row.sprite.id, region.id, 'sourceText', $event)"
              ></textarea>
              <span
                v-if="row.translation.textRegions.length === 0"
                class="text-xs text-muted-foreground"
                >—</span
              >
            </div>
            <div class="space-y-2 p-3">
              <textarea
                v-for="region in row.translation.textRegions"
                :key="region.id"
                class="min-h-16 w-full resize-y rounded border bg-background px-2 py-1.5 text-xs"
                :aria-label="t('translation.translatedText')"
                :value="region.translatedText ?? ''"
                @input="updateText(row.sprite.id, region.id, 'translatedText', $event)"
              ></textarea>
              <span
                v-if="row.translation.textRegions.length === 0"
                class="text-xs text-muted-foreground"
                >—</span
              >
            </div>
            <div class="flex flex-col items-start gap-2 p-3">
              <TranslationSpritePreview
                :image-url="row.imageUrl"
                :texture-size="row.texture.size"
                :sprite="row.sprite"
                :translation="row.translation"
                :background-url="backgroundUrl(row.translation.backgroundId)"
                output
                :output-blank="row.translation.backgroundType === 'blank'"
                :preview-background="workspace.previewBackground"
              />
              <div class="flex w-full gap-2">
                <span class="flex h-7 flex-1 items-center rounded border px-2 text-xs">{{
                  t(
                    `translation.background${(row.translation.backgroundType ?? (row.translation.backgroundId ? 'template' : 'original')).replace(/^./, (value) => value.toUpperCase())}`,
                  )
                }}</span
                ><Button
                  variant="outline"
                  size="sm"
                  class="h-7 text-xs"
                  :disabled="workspace.isBusy"
                  @click="
                    editingBackground = {
                      spriteId: row.sprite.id,
                      type: row.translation.backgroundType,
                      backgroundId: row.translation.backgroundId,
                    }
                  "
                  >{{ t('style.edit') }}</Button
                >
              </div>
            </div>
            <div class="space-y-2 p-3">
              <div
                v-for="region in row.translation.textRegions"
                :key="region.id"
                class="rounded border p-2 text-xs"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-medium">{{ styleName(region.styleId) }}</span
                  ><span class="text-muted-foreground">{{
                    region.styleId ? t('style.template') : t('style.custom')
                  }}</span>
                </div>
                <p class="mt-1 truncate text-muted-foreground">
                  {{ region.render?.fontFamily ?? 'sans-serif' }} ·
                  {{ region.render?.fontSize ?? 24 }}px ·
                  {{ region.render?.fill?.color ?? region.render?.color ?? '#ffffff' }}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  class="mt-2 h-7 w-full text-xs"
                  @click="
                    openStyleEditor(
                      row.sprite.id,
                      region.id,
                      region.translatedText ?? '',
                      region.render,
                      region.styleId,
                    )
                  "
                  >{{ t('style.edit') }}</Button
                >
              </div>
              <span
                v-if="row.translation.textRegions.length === 0"
                class="text-xs text-muted-foreground"
                >—</span
              >
            </div>
          </article>
        </template>
      </div>
    </template>
    <TextStyleEditorDialog
      :open="editingStyle !== undefined"
      :text="editingStyle?.text ?? ''"
      :render="editingStyle?.render"
      :style-id="editingStyle?.styleId"
      :preview-background="workspace.previewBackground"
      @close="editingStyle = undefined"
      @save="saveStyle"
    />
    <BackgroundEditorDialog
      :open="editingBackground !== undefined"
      :type="editingBackground?.type"
      :background-id="editingBackground?.backgroundId"
      :templates="workspace.project?.backgroundTemplates ?? []"
      :sprite-backgrounds="
        selectedSpriteTable && editingBackground
          ? workspace.spriteBackgroundsForSprite(
              selectedSpriteTable.id,
              editingBackground.spriteId,
            )
          : []
      "
      :image-urls="workspace.backgroundImageUrls"
      @close="editingBackground = undefined"
      @save="saveBackground"
      @upload="uploadBackground"
      @rename-template="renameTemplate"
      @replace-template="replaceTemplate"
      @delete-template="deleteTemplate"
    />
  </section>
</template>
