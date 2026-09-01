<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  FilePlus2,
  Folder,
  FolderOpen,
  FileOutput,
  Image,
  Images,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { useWorkspaceStore } from '@/app/stores/workspace'
import { showAlert } from '@/app/services/alertDialog'
import type { TextDiagnostic } from '@/application/qa/TextDiagnostics'
import SpritePreview from '@/components/sprite/SpritePreview.vue'
import TranslationWorkspace from '@/components/translation/TranslationWorkspace.vue'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Rect } from '@/domain/shared/geometry'

const workspace = useWorkspaceStore()
const { locale, t } = useI18n()
const projectName = ref(workspace.project?.name ?? '')
const saved = ref(false)

const errorText = computed(() =>
  workspace.error ? t(workspace.error.key, workspace.error.params ?? {}) : '',
)
const selectedImageUrl = computed(() => {
  const spriteTable = workspace.selectedSpriteTable
  const texture = workspace.selectedTexture
  return spriteTable && texture
    ? workspace.textureImageUrls[spriteTable.id]?.[texture.id]
    : undefined
})
const statusText = computed(() => {
  if (workspace.status === 'opening') return t('status.opening')
  if (workspace.status === 'saving') return t('status.saving')
  if (workspace.status === 'building') {
    const progress = workspace.buildProgress
    return progress?.total
      ? t('status.buildingProgress', { completed: progress.completed, total: progress.total })
      : t('status.building')
  }
  if (workspace.status === 'error') return t('status.error')
  if (workspace.isDirty) return t('status.unsaved')
  return t('status.ready')
})
const hasBuildProgress = computed(
  () => workspace.status === 'building' && (workspace.buildProgress?.total ?? 0) > 0,
)
const buildProgressValue = computed(() => {
  const progress = workspace.buildProgress
  return progress?.total ? (progress.completed / progress.total) * 100 : 0
})
const lastBuildText = computed(() => {
  const report = workspace.lastBuildReport
  if (!report) return undefined

  const summary = report.failures.length
    ? t('build.partial', {
        textures: report.textures.length,
        sprites: report.modifiedSpriteCount,
        failures: report.failures.length,
      })
    : t('build.completed', {
        textures: report.textures.length,
        sprites: report.modifiedSpriteCount,
      })

  return `${summary} · ${t('build.duration', { duration: report.durationMs })}`
})
function buildFailureText(
  failure: NonNullable<typeof workspace.lastBuildReport>['failures'][number],
) {
  const params = {
    spriteTableId: failure.spriteTableId,
    textureId: failure.textureId,
    texturePath: failure.texturePath,
    spriteId: failure.spriteId,
    message: failure.message,
  }
  return t(failure.spriteId ? 'build.spriteFailure' : 'build.failure', params)
}
const lastSavedText = computed(() => {
  const savedAt = workspace.lastSavedAt
  return savedAt
    ? t('status.savedAt', {
        time: savedAt.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' }),
      })
    : undefined
})
const spriteTranslationEnabled = computed(() => workspace.selectedSpriteTranslation !== undefined)
const selectedTextDiagnostics = computed(() => workspace.selectedTextDiagnostics)

watch(
  () => workspace.project?.name,
  (name) => {
    projectName.value = name ?? ''
    saved.value = false
  },
)

async function newProject(): Promise<void> {
  await workspace.createLocalProject(t('project.untitled'))
}

function updateProjectName(): boolean {
  saved.value = false
  return workspace.saveProjectName(projectName.value)
}

async function saveProject(): Promise<void> {
  if (!updateProjectName()) return
  saved.value = await workspace.saveProject()
}

async function buildTextures(): Promise<void> {
  if (await workspace.buildTextures()) {
    toast.success(t('build.successToast'), { description: t('build.outputDirectory') })
  }
}

function isSpriteTranslationEnabled(spriteTableId: string, spriteId: string): boolean {
  return (
    workspace.project?.translations?.some(
      (translation) =>
        translation.spriteTableId === spriteTableId && translation.spriteId === spriteId,
    ) ?? false
  )
}

async function toggleTranslation(event: Event): Promise<void> {
  await workspace.setSpriteTranslationEnabled((event.target as HTMLInputElement).checked)
}

function numericRegionField(
  field: 'x' | 'y' | 'width' | 'height' | 'rotation',
  event: Event,
): void {
  const region = workspace.selectedTextRegion
  const value = Number((event.target as HTMLInputElement).value)
  if (
    !region ||
    !Number.isFinite(value) ||
    (field !== 'rotation' && value < (field === 'width' || field === 'height' ? 1 : 0))
  )
    return

  if (field === 'rotation') {
    void workspace.updateTextRegion(region.id, { rotation: value })
  } else {
    void workspace.updateTextRegion(region.id, { rect: { ...region.rect, [field]: value } })
  }
}
function updateRegionRect(regionId: string, rect: Rect): void {
  void workspace.updateTextRegion(regionId, { rect })
}

function diagnosticText(diagnostic: TextDiagnostic): string {
  return t(`translation.${diagnostic.code}`, {
    label: workspace.selectedTextRegion?.translationKey ?? diagnostic.regionId,
    fontId: diagnostic.fontId,
  })
}

async function updateTranslationKey(event: FocusEvent): Promise<void> {
  const input = event.target as HTMLInputElement
  const region = workspace.selectedTextRegion
  if (!region) return

  const key = input.value.trim()
  const validationError = workspace.validateTranslationKey(region.id, key)
  if (validationError) {
    input.value = region.translationKey
    await showAlert({
      title: t('textRegion.invalidKeyTitle'),
      message: t(`textRegion.${validationError}Key`),
      confirmLabel: t('common.ok'),
    })
    input.focus()
    return
  }

  input.value = key
  if (key !== region.translationKey) {
    await workspace.updateTextRegion(region.id, { translationKey: key })
  }
}

function selectPreviewBackground(background: 'transparent' | 'black' | 'white'): void {
  workspace.setPreviewBackground(background)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-muted/20">
    <div class="flex h-10 shrink-0 items-center gap-1 border-b bg-background px-2">
      <div class="inline-flex items-center text-xs">
        <button
          type="button"
          class="rounded px-2 py-1.5"
          :class="workspace.mode === 'sprites' ? 'bg-accent font-medium' : 'text-muted-foreground'"
          @click="workspace.setMode('sprites')"
        >
          {{ t('mode.sprites') }}
        </button>
        <span class="px-1 text-muted-foreground" aria-hidden="true">|</span>
        <button
          type="button"
          class="rounded px-2 py-1.5"
          :class="
            workspace.mode === 'translations' ? 'bg-accent font-medium' : 'text-muted-foreground'
          "
          @click="workspace.setMode('translations')"
        >
          {{ t('mode.translations') }}
        </button>
      </div>
      <div class="mx-1 h-5 border-l" aria-hidden="true"></div>
      <Button
        variant="ghost"
        size="icon"
        class="size-8"
        :disabled="workspace.isBusy || !workspace.canUndo"
        :title="t('history.undoTooltip')"
        :aria-label="t('history.undoTooltip')"
        @click="workspace.undo"
      >
        <Undo2 class="size-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="size-8"
        :disabled="workspace.isBusy || !workspace.canRedo"
        :title="t('history.redoTooltip')"
        :aria-label="t('history.redoTooltip')"
        @click="workspace.redo"
      >
        <Redo2 class="size-4" aria-hidden="true" />
      </Button>
      <div class="mx-1 h-5 border-l" aria-hidden="true"></div>
      <DropdownMenu>
        <DropdownMenuTrigger class="rounded px-2 py-1.5 text-xs hover:bg-accent">
          {{ t('previewBackground.label') }}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            :model-value="workspace.previewBackground"
            @update:model-value="
              selectPreviewBackground($event as 'transparent' | 'black' | 'white')
            "
          >
            <DropdownMenuRadioItem
              v-for="option in ['transparent', 'black', 'white'] as const"
              :key="option"
              :value="option"
            >
              {{ t(`previewBackground.${option}`) }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        size="sm"
        class="ml-auto"
        data-testid="build-textures"
        :disabled="workspace.isBusy || !workspace.project"
        :aria-busy="workspace.status === 'building'"
        @click="buildTextures"
      >
        <Spinner v-if="workspace.status === 'building'" data-icon="inline-start" />
        <FileOutput v-else data-icon="inline-start" aria-hidden="true" />
        {{ t('build.action') }}
      </Button>
    </div>
    <p
      v-if="errorText"
      class="border-b bg-destructive/5 px-3 py-1.5 text-xs text-destructive"
      role="alert"
    >
      {{ errorText }}
    </p>
    <ul
      v-if="workspace.lastBuildReport?.failures.length"
      class="max-h-36 space-y-1 overflow-auto border-b bg-destructive/5 px-3 py-2 text-xs text-destructive"
      :aria-label="t('build.failures')"
    >
      <li
        v-for="failure in workspace.lastBuildReport.failures"
        :key="JSON.stringify([failure.spriteTableId, failure.textureId])"
      >
        {{ buildFailureText(failure) }}
      </li>
    </ul>

    <div class="flex min-h-0 flex-1">
      <aside class="flex w-64 shrink-0 flex-col border-r bg-card">
        <div
          class="flex h-8 shrink-0 items-center border-b px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {{ t('panel.project') }}
        </div>
        <div class="min-h-0 flex-1 overflow-auto p-1.5 text-xs">
          <template v-if="workspace.project">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
              :class="{ 'bg-accent': !workspace.selectedSpriteTableId }"
              @click="workspace.selectProject"
            >
              <Folder class="size-3.5 shrink-0" aria-hidden="true" /><span
                class="truncate font-medium"
                >{{ workspace.project.name }}</span
              >
            </button>
            <div v-for="spriteTable in workspace.spriteTables" :key="spriteTable.id" class="mt-0.5">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded py-1.5 pr-2 pl-5 text-left hover:bg-accent"
                :class="{
                  'bg-accent':
                    workspace.selectedSpriteTableId === spriteTable.id &&
                    !workspace.selectedSpriteId,
                }"
                @click="workspace.selectSpriteTable(spriteTable.id)"
              >
                <Images class="size-3.5 shrink-0" aria-hidden="true" /><span class="truncate">{{
                  spriteTable.name
                }}</span
                ><span class="ml-auto text-[10px] text-muted-foreground">{{
                  spriteTable.sprites.length
                }}</span>
              </button>
              <template v-if="workspace.mode === 'sprites'">
                <button
                  v-for="sprite in spriteTable.sprites"
                  :key="sprite.id"
                  type="button"
                  class="flex w-full items-center gap-2 rounded py-1.5 pr-2 pl-9 text-left hover:bg-accent"
                  :class="{
                    'bg-accent':
                      workspace.selectedSpriteTableId === spriteTable.id &&
                      workspace.selectedSpriteId === sprite.id,
                    'font-semibold': isSpriteTranslationEnabled(spriteTable.id, sprite.id),
                  }"
                  @click="workspace.selectSprite(spriteTable.id, sprite.id)"
                >
                  <Image class="size-3.5 shrink-0" aria-hidden="true" /><span class="truncate">{{
                    sprite.name
                  }}</span>
                </button>
              </template>
            </div>
            <p v-if="workspace.spriteTables.length === 0" class="px-2 py-3 text-muted-foreground">
              {{ t('workspace.noSpriteTables') }}
            </p>
          </template>
          <p v-else class="px-2 py-3 text-muted-foreground">{{ t('panel.empty') }}</p>
        </div>
      </aside>

      <main
        class="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-workspace"
      >
        <TranslationWorkspace v-if="workspace.mode === 'translations'" class="self-stretch" />
        <div
          v-else-if="!workspace.project"
          class="w-80 rounded-lg border bg-card p-6 text-center shadow-sm"
        >
          <div
            class="mx-auto flex size-11 items-center justify-center rounded-md border bg-muted/50"
          >
            <Image class="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 class="mt-4 text-base font-semibold">{{ t('workspace.emptyTitle') }}</h1>
          <p class="mt-1 text-sm text-muted-foreground">{{ t('workspace.emptyHint') }}</p>
          <div class="mt-5 flex justify-center gap-2">
            <Button :disabled="workspace.isBusy" @click="newProject"
              ><FilePlus2 class="size-4" aria-hidden="true" />{{
                t('workspace.newProject')
              }}</Button
            ><Button
              variant="outline"
              :disabled="workspace.isBusy"
              @click="workspace.openLocalProject"
              ><FolderOpen class="size-4" aria-hidden="true" />{{
                t('workspace.openProject')
              }}</Button
            >
          </div>
        </div>
        <SpritePreview
          v-else-if="workspace.selectedTexture && workspace.selectedSprite && selectedImageUrl"
          :image-url="selectedImageUrl"
          :texture-size="workspace.selectedTexture.size"
          :sprite="workspace.selectedSprite"
          :text-regions="workspace.selectedSpriteTranslation?.textRegions"
          :selected-text-region-id="workspace.selectedTextRegionId"
          :editable="spriteTranslationEnabled"
          @create-region="workspace.addTextRegion"
          @select-region="workspace.selectTextRegion"
          @update-region="updateRegionRect"
        />
        <div v-else-if="workspace.spriteTables.length === 0" class="text-center">
          <p class="text-sm font-medium">{{ t('workspace.noSpriteTables') }}</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('workspace.noSpriteTablesHint') }}</p>
        </div>
        <div v-else class="text-center">
          <p class="text-sm text-muted-foreground">{{ t('workspace.noSprite') }}</p>
        </div>
      </main>

      <aside
        v-if="workspace.mode === 'sprites'"
        class="flex w-64 shrink-0 flex-col border-l bg-card"
      >
        <div
          class="flex h-8 shrink-0 items-center border-b px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {{ t('panel.inspector') }}
        </div>
        <div
          v-if="
            workspace.selectedSprite && workspace.selectedSpriteTable && workspace.selectedTexture
          "
          class="space-y-4 p-3 text-xs"
        >
          <div>
            <p class="truncate font-semibold">{{ workspace.selectedSprite.name }}</p>
            <p class="mt-0.5 truncate text-muted-foreground">{{ workspace.selectedSprite.id }}</p>
          </div>

          <dl class="space-y-2">
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('sprite.spriteTable') }}</dt>
              <dd class="max-w-36 truncate">{{ workspace.selectedSpriteTable.name }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('sprite.texture') }}</dt>
              <dd class="max-w-36 truncate">{{ workspace.selectedTexture.id }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('sprite.frame') }}</dt>
              <dd>
                {{ workspace.selectedSprite.frame.x }}, {{ workspace.selectedSprite.frame.y }} ·
                {{ workspace.selectedSprite.frame.width }} ×
                {{ workspace.selectedSprite.frame.height }}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('sprite.rotation') }}</dt>
              <dd>{{ workspace.selectedSprite.rotation }}°</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('sprite.trimmed') }}</dt>
              <dd>{{ t(workspace.selectedSprite.trimmed ? 'common.yes' : 'common.no') }}</dd>
            </div>
            <div v-if="workspace.selectedSprite.originalSize" class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('sprite.originalSize') }}</dt>
              <dd>
                {{ workspace.selectedSprite.originalSize.width }} ×
                {{ workspace.selectedSprite.originalSize.height }}
              </dd>
            </div>
          </dl>

          <label
            class="flex cursor-pointer items-center justify-between gap-3 rounded border px-2 py-2"
          >
            <span>{{ t('sprite.translate') }}</span>
            <input
              type="checkbox"
              :checked="spriteTranslationEnabled"
              :disabled="workspace.isBusy"
              @change="toggleTranslation"
            />
          </label>

          <template v-if="spriteTranslationEnabled">
            <div class="border-t pt-3">
              <div class="mb-2 flex items-center justify-between">
                <span class="font-semibold">{{ t('textRegion.title') }}</span>
                <span class="text-muted-foreground">
                  {{ workspace.selectedSpriteTranslation?.textRegions.length }}
                </span>
              </div>
              <p
                v-if="workspace.selectedSpriteTranslation?.textRegions.length === 0"
                class="text-muted-foreground"
              >
                {{ t('textRegion.drawHint') }}
              </p>
              <button
                v-for="region in workspace.selectedSpriteTranslation?.textRegions"
                :key="region.id"
                type="button"
                class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-accent"
                :class="{ 'bg-accent': region.id === workspace.selectedTextRegionId }"
                @click="workspace.selectTextRegion(region.id)"
              >
                <span class="truncate">{{ region.translationKey }}</span>
                <span class="text-muted-foreground"
                  >{{ region.rect.width }} × {{ region.rect.height }}</span
                >
              </button>
            </div>

            <div v-if="workspace.selectedTextRegion" class="space-y-3 border-t pt-3">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="font-semibold">{{ t('textRegion.title') }}</p>
                  <p class="truncate text-muted-foreground">
                    {{ workspace.selectedTextRegion.id }}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  :title="t('textRegion.delete')"
                  :disabled="workspace.isBusy"
                  @click="workspace.removeTextRegion(workspace.selectedTextRegion.id)"
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </div>
              <label class="block text-muted-foreground">
                {{ t('textRegion.key') }}
                <input
                  class="mt-1 h-8 w-full rounded border bg-background px-2 text-foreground"
                  :value="workspace.selectedTextRegion.translationKey"
                  :disabled="workspace.isBusy"
                  @blur="updateTranslationKey"
                />
              </label>
              <div class="grid grid-cols-2 gap-2">
                <label
                  v-for="field in ['x', 'y', 'width', 'height'] as const"
                  :key="field"
                  class="text-muted-foreground"
                >
                  {{ t(`textRegion.${field}`) }}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    class="mt-1 h-8 w-full rounded border bg-background px-2 text-foreground"
                    :value="workspace.selectedTextRegion.rect[field]"
                    :disabled="workspace.isBusy"
                    @change="numericRegionField(field, $event)"
                  />
                </label>
              </div>
              <label class="block text-muted-foreground">
                {{ t('textRegion.rotation') }}
                <input
                  type="number"
                  step="1"
                  class="mt-1 h-8 w-full rounded border bg-background px-2 text-foreground"
                  :value="workspace.selectedTextRegion.rotation"
                  :disabled="workspace.isBusy"
                  @change="numericRegionField('rotation', $event)"
                />
              </label>
              <div
                v-if="selectedTextDiagnostics.length"
                role="status"
                aria-live="polite"
                :aria-label="t('translation.issues', selectedTextDiagnostics.length)"
              >
                <ul class="space-y-1 rounded border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                  <li
                    v-for="diagnostic in selectedTextDiagnostics"
                    :key="JSON.stringify([diagnostic.code, diagnostic.fontId])"
                  >
                    {{ diagnosticText(diagnostic) }}
                  </li>
                </ul>
              </div>
            </div>
            <p class="text-[11px] text-muted-foreground">{{ t('textRegion.sourceSpace') }}</p>
          </template>
        </div>
        <div v-else-if="workspace.selectedSpriteTable" class="space-y-4 p-3 text-xs">
          <div>
            <p class="truncate font-semibold">{{ workspace.selectedSpriteTable.name }}</p>
            <p class="mt-0.5 truncate text-muted-foreground">
              {{ workspace.selectedSpriteTable.id }}
            </p>
          </div>
          <dl class="space-y-2">
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('spriteTable.textures') }}</dt>
              <dd>{{ workspace.selectedSpriteTable.textures.length }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('spriteTable.sprites') }}</dt>
              <dd>{{ workspace.selectedSpriteTable.sprites.length }}</dd>
            </div>
          </dl>
        </div>
        <form v-else-if="workspace.project" class="space-y-4 p-3" @submit.prevent="saveProject">
          <p class="text-xs font-semibold">{{ t('project.settings') }}</p>
          <div>
            <label for="project-name" class="text-xs text-muted-foreground">{{
              t('project.name')
            }}</label
            ><input
              id="project-name"
              v-model="projectName"
              class="mt-1 h-8 w-full rounded border bg-background px-2 text-sm"
              @input="saved = false"
              @blur="updateProjectName"
            />
          </div>
          <dl class="space-y-2 text-xs">
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('project.schema') }}</dt>
              <dd>v{{ workspace.project.schemaVersion }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('project.sourceLocale') }}</dt>
              <dd>{{ workspace.project.sourceLocale || t('project.notSet') }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('project.targetLocales') }}</dt>
              <dd class="truncate">
                {{ workspace.project.targetLocales?.join(', ') || t('project.notSet') }}
              </dd>
            </div>
          </dl>
          <Button type="submit" size="sm" class="w-full" :disabled="workspace.isBusy"
            ><Save class="size-3.5" aria-hidden="true" />{{
              workspace.status === 'saving' ? t('project.saving') : t('project.save')
            }}</Button
          >
          <p v-if="saved && !errorText" class="text-center text-xs text-emerald-600">
            {{ t('project.saved') }}
          </p>
        </form>
        <p v-else class="p-3 text-xs text-muted-foreground">{{ t('panel.empty') }}</p>
      </aside>
    </div>
    <footer
      class="flex h-6 shrink-0 items-center border-t bg-card px-2 text-[11px] text-muted-foreground"
    >
      <div role="status" aria-live="polite" aria-atomic="true" class="flex items-center">
        <span>{{ statusText }}</span>
        <Progress
          v-if="hasBuildProgress"
          :model-value="buildProgressValue"
          class="ml-2 w-20"
          :aria-label="statusText"
        />
        <time
          v-if="lastSavedText && workspace.lastSavedAt"
          class="ml-3"
          :datetime="workspace.lastSavedAt.toISOString()"
        >
          {{ lastSavedText }}
        </time>
      </div>
      <span
        :class="{ 'ml-3': lastBuildText }"
        role="status"
        :aria-label="t('build.result')"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ lastBuildText }}
      </span>
      <span v-if="workspace.selectedSprite" class="ml-3">{{ workspace.selectedSprite.name }}</span>
      <span v-if="workspace.directoryName" class="ml-auto truncate">{{
        workspace.directoryName
      }}</span>
    </footer>
  </div>
</template>
