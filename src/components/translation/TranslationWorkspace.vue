<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkspaceStore } from '@/app/stores/workspace'
import { showAlert } from '@/app/services/alertDialog'
import type { TextDiagnostic } from '@/application/qa/TextDiagnostics'
import TranslationSpritePreview from '@/components/translation/TranslationSpritePreview.vue'
import TextStyleEditorDialog from '@/components/translation/TextStyleEditorDialog.vue'
import BackgroundEditorDialog from '@/components/translation/BackgroundEditorDialog.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { resolveBackgroundType, type TextRenderConfig } from '@/domain/text-region/types'
import { textStyleTemplates } from '@/domain/text-region/styleTemplates'

const workspace = useWorkspaceStore()
const { t } = useI18n()
const selectedSpriteTable = computed(() => workspace.selectedSpriteTable)
const editingStyle = ref<{
  spriteTableId: string
  spriteId: string
  regionId: string
  text: string
  render?: TextRenderConfig
  styleId?: string
}>()
const editingBackground = ref<{
  spriteTableId: string
  spriteId: string
  type?: 'original' | 'blank' | 'template' | 'sprite'
  backgroundId?: string
}>()
const columnRatios = ref([1.25, 1, 1, 1.25, 1])
const diagnosticDisplayCount = ref(12)
const translatedTextInputs = new Map<string, HTMLTextAreaElement>()
const translationRowsBySprite = new Map<string, HTMLElement>()
const searchQuery = ref('')
const translationFilter = ref<'all' | 'complete' | 'incomplete' | 'issues'>('all')
const spriteTableFilter = ref<string>('all')
const editingSpriteKey = ref<string>()
let resizingColumn: number | undefined
let resizeStartX = 0
let resizeStartRatios: number[] = []
let editingClearTimer: ReturnType<typeof setTimeout> | undefined

const tableStyle = computed(() => ({
  gridTemplateColumns: columnRatios.value.map((ratio) => `minmax(0, ${ratio}fr)`).join(' '),
}))
const availableSpriteTables = computed(() => workspace.spriteTables)
const translationRows = computed(() => {
  const spriteTables = workspace.spriteTables
  const translations = workspace.project?.translations ?? []
  if (!spriteTables.length) return []

  return spriteTables.flatMap((spriteTable) =>
    spriteTable.sprites.flatMap((sprite) => {
      const translation = translations.find(
        (item) => item.spriteTableId === spriteTable.id && item.spriteId === sprite.id,
      )
      const texture = spriteTable.textures.find((item) => item.id === sprite.textureId)
      const imageUrl = texture
        ? workspace.textureImageUrls[spriteTable.id]?.[texture.id]
        : undefined
      return translation && texture && imageUrl
        ? [
            {
              sprite,
              spriteTable,
              translation,
              texture,
              imageUrl,
              searchText: [
                spriteTable.name,
                spriteTable.id,
                sprite.id,
                sprite.name,
                ...translation.textRegions.flatMap((region) => [
                  region.translationKey,
                  region.sourceText ?? '',
                  region.translatedText ?? '',
                ]),
              ]
                .join('\u0000')
                .toLocaleLowerCase(),
            },
          ]
        : []
    }),
  )
})
const hasActiveFilters = computed(
  () =>
    searchQuery.value.trim().length > 0 ||
    translationFilter.value !== 'all' ||
    spriteTableFilter.value !== 'all',
)
const totalRowsCount = computed(() => translationRows.value.length)
const filteredRowsCount = computed(() => filteredTranslationRows.value.length)
const hasBackgroundIssueSprites = computed(() => {
  const set = new Set<string>()
  const translations = workspace.project?.translations ?? []
  for (const diag of workspace.backgroundDiagnostics) {
    for (const t of translations) {
      if (
        t.backgroundId === diag.resourceId &&
        (resolveBackgroundType(t) === 'template' || resolveBackgroundType(t) === 'sprite')
      ) {
        set.add(spriteKey(t.spriteTableId, t.spriteId))
      }
    }
  }
  return set
})
const diagnosticSprites = computed(() => {
  const set = new Set<string>(
    workspace.textDiagnostics.map((item) => spriteKey(item.spriteTableId, item.spriteId)),
  )
  for (const key of hasBackgroundIssueSprites.value) {
    set.add(key)
  }
  return set
})

function clearFilters(): void {
  searchQuery.value = ''
  translationFilter.value = 'all'
  spriteTableFilter.value = 'all'
}
const filteredTranslationRows = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  const tableFilter = spriteTableFilter.value
  return translationRows.value.filter((row) => {
    if (editingSpriteKey.value === spriteKey(row.translation.spriteTableId, row.sprite.id)) {
      return true
    }
    if (tableFilter !== 'all' && row.translation.spriteTableId !== tableFilter) {
      return false
    }
    const regions = row.translation.textRegions
    const complete = regions.length > 0 && regions.every((region) => region.translatedText?.trim())
    const hasIssue = diagnosticSprites.value.has(
      spriteKey(row.translation.spriteTableId, row.sprite.id),
    )
    if (
      (translationFilter.value === 'complete' && !complete) ||
      (translationFilter.value === 'incomplete' && complete) ||
      (translationFilter.value === 'issues' && !hasIssue)
    ) {
      return false
    }
    if (!query) return true
    return row.searchText.includes(query)
  })
})
const visibleDiagnostics = computed(() =>
  workspace.textDiagnostics.slice(0, diagnosticDisplayCount.value),
)
const remainingDiagnosticCount = computed(() =>
  Math.max(0, workspace.textDiagnostics.length - visibleDiagnostics.value.length),
)
const diagnosticItems = computed(() => {
  const spriteTablesById = new Map(workspace.spriteTables.map((item) => [item.id, item]))
  const spritesByKey = new Map(
    workspace.spriteTables.flatMap((spriteTable) =>
      spriteTable.sprites.map((sprite) => [spriteKey(spriteTable.id, sprite.id), sprite]),
    ),
  )
  const regionsBySprite = new Map(
    (workspace.project?.translations ?? []).map((translation) => [
      spriteKey(translation.spriteTableId, translation.spriteId),
      new Map(translation.textRegions.map((region) => [region.id, region.translationKey])),
    ]),
  )

  return visibleDiagnostics.value.map((diagnostic) => {
    const spriteTable = spriteTablesById.get(diagnostic.spriteTableId)
    const sprite = spritesByKey.get(spriteKey(diagnostic.spriteTableId, diagnostic.spriteId))
    const region = regionsBySprite
      .get(spriteKey(diagnostic.spriteTableId, diagnostic.spriteId))
      ?.get(diagnostic.regionId)
    return {
      diagnostic,
      label: [
        spriteTable?.name ?? diagnostic.spriteTableId,
        sprite?.id ?? diagnostic.spriteId,
        region ?? diagnostic.regionId,
      ].join(' / '),
    }
  })
})
const backgroundDiagnosticItems = computed(() =>
  workspace.backgroundDiagnostics.flatMap((diagnostic) => {
    const translations = (workspace.project?.translations ?? []).filter(
      (translation) =>
        translation.backgroundId === diagnostic.resourceId &&
        (resolveBackgroundType(translation) === 'template' ||
          resolveBackgroundType(translation) === 'sprite'),
    )
    return translations.map((translation) => ({
      diagnostic,
      spriteTableId: translation.spriteTableId,
      spriteId: translation.spriteId,
      label: `${translation.spriteTableId} / ${translation.spriteId}`,
    }))
  }),
)

function backgroundUrl(backgroundId?: string): string | undefined {
  return backgroundId ? workspace.backgroundImageUrls[backgroundId] : undefined
}

function setTranslationRow(key: string, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) translationRowsBySprite.set(key, element)
  else translationRowsBySprite.delete(key)
}

async function selectBackgroundDiagnostic(item: {
  spriteTableId: string
  spriteId: string
}): Promise<void> {
  const sprite = workspace.spriteTables
    .find((table) => table.id === item.spriteTableId)
    ?.sprites.find((candidate) => candidate.id === item.spriteId)
  if (!sprite) return
  searchQuery.value = ''
  translationFilter.value = 'all'
  spriteTableFilter.value = 'all'
  workspace.selectSprite(item.spriteTableId, item.spriteId)
  await nextTick()
  const row = translationRowsBySprite.get(spriteKey(item.spriteTableId, item.spriteId))
  row?.scrollIntoView?.({ block: 'center' })
  row?.focus?.({ preventScroll: true })
}

function styleName(styleId?: string): string {
  return (
    [...textStyleTemplates, ...(workspace.project?.textStyleTemplates ?? [])].find(
      (template) => template.id === styleId,
    )?.name ?? t('style.custom')
  )
}

function spriteKey(spriteTableId: string, spriteId: string): string {
  return JSON.stringify([spriteTableId, spriteId])
}

function textRegionKey(spriteTableId: string, spriteId: string, regionId: string): string {
  return JSON.stringify([spriteTableId, spriteId, regionId])
}

function setTranslatedTextInput(
  key: string,
  element: Element | ComponentPublicInstance | null,
): void {
  if (element instanceof HTMLTextAreaElement) {
    translatedTextInputs.set(key, element)
  } else {
    translatedTextInputs.delete(key)
  }
}

function isSelectedTextRegion(spriteTableId: string, spriteId: string, regionId: string): boolean {
  return (
    workspace.selectedSpriteTableId === spriteTableId &&
    workspace.selectedSpriteId === spriteId &&
    workspace.selectedTextRegionId === regionId
  )
}

async function selectDiagnostic(diagnostic: TextDiagnostic): Promise<void> {
  if (!workspace.selectTextDiagnostic(diagnostic)) return

  searchQuery.value = ''
  translationFilter.value = 'all'
  spriteTableFilter.value = 'all'
  await nextTick()
  const input = translatedTextInputs.get(
    textRegionKey(diagnostic.spriteTableId, diagnostic.spriteId, diagnostic.regionId),
  )
  input?.scrollIntoView({ block: 'center' })
  input?.focus({ preventScroll: true })
}

async function moveTranslatedTextFocus(
  spriteTableId: string,
  spriteId: string,
  regionId: string,
  direction: -1 | 1,
): Promise<void> {
  const regions = filteredTranslationRows.value.flatMap((row) =>
    row.translation.textRegions.map((region) => ({
      regionId: region.id,
      spriteId: row.sprite.id,
      spriteTableId: row.translation.spriteTableId,
    })),
  )
  const index = regions.findIndex(
    (region) =>
      region.spriteTableId === spriteTableId &&
      region.spriteId === spriteId &&
      region.regionId === regionId,
  )
  const next = index < 0 ? undefined : regions[index + direction]
  if (!next) return
  workspace.selectSprite(next.spriteTableId, next.spriteId)
  workspace.selectTextRegion(next.regionId)
  await nextTick()
  translatedTextInputs.get(textRegionKey(next.spriteTableId, next.spriteId, next.regionId))?.focus()
}

function handleTranslatedTextKeydown(
  event: KeyboardEvent,
  spriteTableId: string,
  spriteId: string,
  regionId: string,
): void {
  if (event.isComposing || event.shiftKey || !event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    void moveTranslatedTextFocus(spriteTableId, spriteId, regionId, 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    void moveTranslatedTextFocus(spriteTableId, spriteId, regionId, -1)
  }
}

function beginTextEdit(spriteTableId: string, spriteId: string): void {
  if (editingClearTimer) clearTimeout(editingClearTimer)
  editingSpriteKey.value = spriteKey(spriteTableId, spriteId)
}

function finishTextEdit(spriteTableId: string, spriteId: string): void {
  const key = spriteKey(spriteTableId, spriteId)
  editingClearTimer = setTimeout(() => {
    if (editingSpriteKey.value === key) editingSpriteKey.value = undefined
  })
}

function showMoreDiagnostics(): void {
  diagnosticDisplayCount.value += 12
}

function diagnosticMessage(diagnostic: TextDiagnostic, label: string): string {
  return t(`translation.${diagnostic.code}`, { label, fontId: diagnostic.fontId })
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
  spriteTableId: string,
  spriteId: string,
  regionId: string,
  field: 'sourceText' | 'translatedText',
  event: Event,
): void {
  const target = event.target as HTMLTextAreaElement | null
  const value = target?.value ?? ''
  workspace.updateTranslationText(spriteTableId, spriteId, regionId, field, value)
}

function openStyleEditor(
  spriteTableId: string,
  spriteId: string,
  regionId: string,
  text: string,
  render?: TextRenderConfig,
  styleId?: string,
): void {
  editingStyle.value = { spriteTableId, spriteId, regionId, text, render, styleId }
}

function saveStyle(render: TextRenderConfig, styleId?: string): void {
  if (!editingStyle.value) return
  const editing = editingStyle.value
  if (
    !workspace.updateTranslationRegion(editing.spriteTableId, editing.spriteId, editing.regionId, {
      render,
      styleId,
    })
  ) {
    return
  }
  editingStyle.value = undefined
}

function saveStyleTemplate(name: string, render: TextRenderConfig, id?: string): void {
  workspace.saveTextStyleTemplate(name, render, id)
}

async function deleteStyleTemplate(id: string): Promise<void> {
  const references = workspace.textStyleTemplateReferenceCount(id)
  if (references > 0) {
    await showAlert({
      title: t('style.templateInUseTitle'),
      message: t('style.templateInUse', { count: references }),
      confirmLabel: t('common.ok'),
    })
    return
  }
  if (workspace.deleteTextStyleTemplate(id) && editingStyle.value?.styleId === id) {
    editingStyle.value = { ...editingStyle.value, styleId: undefined }
  }
}

function saveBackground(
  type: 'original' | 'blank' | 'template' | 'sprite',
  backgroundId?: string,
): void {
  if (!editingBackground.value) return
  if (
    workspace.setSpriteTranslationBackground(
      editingBackground.value.spriteTableId,
      editingBackground.value.spriteId,
      backgroundId,
      type,
    )
  ) {
    editingBackground.value = undefined
  }
}

async function uploadBackground(scope: 'template' | 'sprite', file: File): Promise<void> {
  if (!editingBackground.value) return
  const spriteTableId = editingBackground.value.spriteTableId
  const spriteId = editingBackground.value.spriteId
  const backgroundId =
    scope === 'template'
      ? await workspace.addBackgroundTemplate(file)
      : await workspace.addSpriteBackground(spriteTableId, spriteId, file)
  if (
    backgroundId &&
    editingBackground.value?.spriteId === spriteId &&
    editingBackground.value?.spriteTableId === spriteTableId
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

onUnmounted(() => {
  finishResize()
  if (editingClearTimer) clearTimeout(editingClearTimer)
})
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
      <div
        v-if="workspace.backgroundDiagnostics.length"
        class="border-b bg-destructive/5 px-3 py-2 text-xs text-destructive"
        role="alert"
      >
        <p class="font-medium">{{ t('translation.backgroundDiagnostics') }}</p>
        <div class="mt-1 max-h-24 space-y-1 overflow-y-auto">
          <template
            v-for="diagnostic in workspace.backgroundDiagnostics"
            :key="diagnostic.resourceId"
          >
            <p>{{ diagnostic.path }} · {{ diagnostic.message }}</p>
            <Button
              v-for="item in backgroundDiagnosticItems.filter(
                (item) => item.diagnostic.resourceId === diagnostic.resourceId,
              )"
              :key="JSON.stringify([item.spriteTableId, item.spriteId])"
              variant="outline"
              size="sm"
              class="max-w-72"
              :aria-label="t('translation.goToIssue', { label: item.label })"
              @click="selectBackgroundDiagnostic(item)"
            >
              <span class="truncate">{{ item.label }}</span>
            </Button>
          </template>
        </div>
      </div>
      <div
        v-if="workspace.textDiagnostics.length"
        class="border-b bg-muted/40 px-3 py-2"
        role="region"
        :aria-label="t('translation.issues', workspace.textDiagnostics.length)"
      >
        <p class="text-xs font-medium" role="status" aria-live="polite">
          {{ t('translation.issues', workspace.textDiagnostics.length) }}
        </p>
        <div class="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto" role="list">
          <div
            v-for="item in diagnosticItems"
            :key="
              JSON.stringify([
                item.diagnostic.spriteTableId,
                item.diagnostic.spriteId,
                item.diagnostic.regionId,
                item.diagnostic.code,
                item.diagnostic.fontId,
              ])
            "
            role="listitem"
          >
            <Button
              variant="outline"
              size="sm"
              class="max-w-72"
              :aria-label="
                t('translation.goToIssue', {
                  label: diagnosticMessage(item.diagnostic, item.label),
                })
              "
              @click="selectDiagnostic(item.diagnostic)"
            >
              <span class="truncate">{{ diagnosticMessage(item.diagnostic, item.label) }}</span>
            </Button>
          </div>
        </div>
        <Button
          v-if="remainingDiagnosticCount"
          variant="ghost"
          size="sm"
          class="mt-1.5"
          @click="showMoreDiagnostics"
        >
          {{ t('translation.showMoreIssues', { count: remainingDiagnosticCount }) }}
        </Button>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div class="flex flex-wrap items-center gap-2">
          <Select v-model="spriteTableFilter">
            <SelectTrigger class="w-44" :aria-label="t('translation.filterSpriteTable')">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{{ t('translation.filterAllSpriteTables') }}</SelectItem>
                <SelectItem
                  v-for="table in availableSpriteTables"
                  :key="table.id"
                  :value="table.id"
                >
                  {{ table.name }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Input
            v-model="searchQuery"
            class="max-w-64"
            :aria-label="t('translation.filterPlaceholder')"
            :placeholder="t('translation.filterPlaceholder')"
          />
          <Select v-model="translationFilter">
            <SelectTrigger class="w-36" :aria-label="t('translation.filterStatus')">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{{ t('translation.filterAll') }}</SelectItem>
                <SelectItem value="incomplete">{{ t('translation.filterIncomplete') }}</SelectItem>
                <SelectItem value="complete">{{ t('translation.filterComplete') }}</SelectItem>
                <SelectItem value="issues">{{ t('translation.filterIssues') }}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            v-if="hasActiveFilters"
            variant="ghost"
            size="sm"
            class="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            :aria-label="t('translation.clearFilters')"
            @click="clearFilters"
          >
            {{ t('translation.clearFilters') }}
          </Button>
        </div>
        <div
          v-if="totalRowsCount > 0"
          class="text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {{
            t('translation.filterResultsCount', {
              filtered: filteredRowsCount,
              total: totalRowsCount,
            })
          }}
        </div>
      </div>
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
        <div
          v-else-if="filteredTranslationRows.length === 0"
          class="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <p>{{ t('translation.noMatches') }}</p>
          <Button
            v-if="hasActiveFilters"
            variant="outline"
            size="sm"
            class="mt-3"
            @click="clearFilters"
          >
            {{ t('translation.clearFilters') }}
          </Button>
        </div>
        <template v-else>
          <article
            v-for="row in filteredTranslationRows"
            :key="spriteKey(row.translation.spriteTableId, row.sprite.id)"
            :ref="
              (element) =>
                setTranslationRow(spriteKey(row.translation.spriteTableId, row.sprite.id), element)
            "
            tabindex="-1"
            class="grid min-w-[900px] border-b bg-card last:border-b-0 focus:outline-none"
            :class="{
              'ring-2 ring-inset ring-primary':
                workspace.selectedSpriteTableId === row.translation.spriteTableId &&
                workspace.selectedSpriteId === row.sprite.id,
            }"
            :style="tableStyle"
          >
            <div class="p-3">
              <TranslationSpritePreview
                :image-url="row.imageUrl"
                :texture-size="row.texture.size"
                :sprite="row.sprite"
                :translation="row.translation"
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
                :disabled="workspace.isBusy"
                @focus="beginTextEdit(row.translation.spriteTableId, row.sprite.id)"
                @blur="finishTextEdit(row.translation.spriteTableId, row.sprite.id)"
                @input="
                  updateText(
                    row.translation.spriteTableId,
                    row.sprite.id,
                    region.id,
                    'sourceText',
                    $event,
                  )
                "
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
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                :class="{
                  'ring-2 ring-primary': isSelectedTextRegion(
                    row.translation.spriteTableId,
                    row.sprite.id,
                    region.id,
                  ),
                }"
                :ref="
                  (element) =>
                    setTranslatedTextInput(
                      textRegionKey(row.translation.spriteTableId, row.sprite.id, region.id),
                      element,
                    )
                "
                :value="region.translatedText ?? ''"
                :disabled="workspace.isBusy"
                @focus="beginTextEdit(row.translation.spriteTableId, row.sprite.id)"
                @blur="finishTextEdit(row.translation.spriteTableId, row.sprite.id)"
                @input="
                  updateText(
                    row.translation.spriteTableId,
                    row.sprite.id,
                    region.id,
                    'translatedText',
                    $event,
                  )
                "
                @keydown="
                  handleTranslatedTextKeydown(
                    $event,
                    row.translation.spriteTableId,
                    row.sprite.id,
                    region.id,
                  )
                "
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
                      spriteTableId: row.translation.spriteTableId,
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
                      row.translation.spriteTableId,
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
      :templates="workspace.project?.textStyleTemplates"
      :fonts="workspace.projectFonts"
      :font-diagnostics="workspace.fontDiagnostics"
      :preview-background="workspace.previewBackground"
      @close="editingStyle = undefined"
      @save="saveStyle"
      @save-template="saveStyleTemplate"
      @delete-template="deleteStyleTemplate"
    />
    <BackgroundEditorDialog
      :open="editingBackground !== undefined"
      :type="editingBackground?.type"
      :background-id="editingBackground?.backgroundId"
      :templates="workspace.project?.backgroundTemplates ?? []"
      :sprite-backgrounds="
        editingBackground
          ? workspace.spriteBackgroundsForSprite(
              editingBackground.spriteTableId,
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
