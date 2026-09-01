<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FormField from '@/components/ui/FormField.vue'
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
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DEFAULT_TEXT_RENDER, textStyleTemplates } from '@/domain/text-region/styleTemplates'
import type {
  GradientStop,
  TextPaint,
  TextRenderConfig,
  TextShadow,
  TextStyleTemplate,
} from '@/domain/text-region/types'
import TextStyleCanvasPreview from '@/components/translation/TextStyleCanvasPreview.vue'
import type { PreviewBackground } from '@/app/stores/workspace'
import type { ProjectFont } from '@/domain/font/types'
import type { FontDiagnostic } from '@/domain/font/types'

const props = defineProps<{
  open: boolean
  text: string
  render?: TextRenderConfig
  styleId?: string
  templates?: TextStyleTemplate[]
  fonts?: ProjectFont[]
  fontDiagnostics?: FontDiagnostic[]
  previewBackground?: PreviewBackground
}>()
const emit = defineEmits<{
  close: []
  save: [render: TextRenderConfig, styleId?: string]
  saveAsTemplate: [name: string, render: TextRenderConfig, overwriteId?: string]
  saveTemplate: [name: string, render: TextRenderConfig, id: string]
  renameTemplate: [id: string, name: string, replaceId?: string]
  deleteTemplate: [id: string]
}>()
const { locale, t } = useI18n()
const draft = ref<TextRenderConfig>({ ...DEFAULT_TEXT_RENDER })
const selectedProjectFontId = ref<string>()
const styleMode = ref<'template' | 'individual'>('individual')
const editingTemplate = ref<TextStyleTemplate>()
const renamingTemplate = ref<TextStyleTemplate>()
const renameDraft = ref('')
const savingAsTemplate = ref(false)
const saveAsName = ref('')
const duplicateNameTarget = ref<TextStyleTemplate>()
const duplicateNameAction = ref<'saveAs' | 'rename'>()
const availableTemplates = computed(() => [...textStyleTemplates, ...(props.templates ?? [])])
const previewText = computed(() => props.text || (locale.value.startsWith('zh') ? '文本' : 'Text'))
const templatePreviewText = computed(() => (locale.value.startsWith('zh') ? '文本' : 'Text'))

function ensureShadows(): TextShadow[] {
  if (!draft.value.shadows) draft.value.shadows = draft.value.shadow ? [draft.value.shadow] : []
  return draft.value.shadows
}

function addShadow(): void {
  ensureShadows().push({ color: '#000000', alpha: 0.6, blur: 3, offsetX: 2, offsetY: 2 })
}

function removeShadow(index: number): void {
  ensureShadows().splice(index, 1)
}

function ensureGradientStops(paint: TextPaint): GradientStop[] {
  if (!paint.gradientStops) {
    paint.gradientStops = [
      { color: paint.color, position: 0, alpha: paint.alpha ?? 1 },
      {
        color: paint.gradientEnd ?? paint.color,
        position: 1,
        alpha: paint.gradientEndAlpha ?? paint.alpha ?? 1,
      },
    ]
  }
  return paint.gradientStops
}

function addGradientStop(paint: TextPaint): void {
  ensureGradientStops(paint).push({ color: paint.color, position: 0.5, alpha: paint.alpha ?? 1 })
}

function removeGradientStop(paint: TextPaint, index: number): void {
  const stops = ensureGradientStops(paint)
  if (stops.length > 2) stops.splice(index, 1)
}

function updateGradientStopPosition(stop: GradientStop, value: string | number): void {
  const percent = Number(value)
  stop.position = Number.isFinite(percent) ? Math.max(0, Math.min(1, percent / 100)) : 0
}

function setAutoFit(enabled: boolean): void {
  draft.value.autoFit = enabled
    ? { minFontSize: Math.min(8, draft.value.fontSize), maxFontSize: draft.value.fontSize }
    : undefined
}

function selectProjectFont(value: unknown): void {
  if (typeof value !== 'string') return
  const id = value
  const font = props.fonts?.find((item) => item.id === id)
  if (!font) return
  selectedProjectFontId.value = id
  draft.value.fontId = id
  draft.value.fontFamily = font.family
  draft.value.fontWeight = font.weight ?? 400
  draft.value.fontStyle = font.style ?? 'normal'
}

function updateFontFamily(value: string | number): void {
  draft.value.fontFamily = String(value)
  draft.value.fontId = undefined
  selectedProjectFontId.value = undefined
}

watch(
  () => [props.open, props.render, props.styleId] as const,
  () => {
    if (!props.open) return
    draft.value = JSON.parse(
      JSON.stringify({ ...DEFAULT_TEXT_RENDER, ...props.render }),
    ) as TextRenderConfig
    selectedProjectFontId.value = draft.value.fontId
    styleMode.value = props.styleId ? 'template' : 'individual'
    editingTemplate.value = undefined
    renamingTemplate.value = undefined
    savingAsTemplate.value = false
    duplicateNameTarget.value = undefined
    duplicateNameAction.value = undefined
  },
  { immediate: true, deep: true },
)

function selectTemplate(id: string): void {
  const template = availableTemplates.value.find((item) => item.id === id)
  if (!template) return
  emit('save', JSON.parse(JSON.stringify(template.render)) as TextRenderConfig, id)
}

function setStyleMode(mode: 'template' | 'individual'): void {
  styleMode.value = mode
  if (mode === 'template') {
    editingTemplate.value = undefined
  }
}

function editTemplate(template: TextStyleTemplate): void {
  if (!props.templates?.some((item) => item.id === template.id)) return
  editingTemplate.value = template
  styleMode.value = 'individual'
  draft.value = JSON.parse(JSON.stringify(template.render)) as TextRenderConfig
  selectedProjectFontId.value = draft.value.fontId
}

function openRename(template: TextStyleTemplate): void {
  if (!props.templates?.some((item) => item.id === template.id)) return
  renamingTemplate.value = template
  renameDraft.value = template.name
}

function projectTemplateWithName(name: string, excludeId?: string): TextStyleTemplate | undefined {
  const normalized = name.trim().toLocaleLowerCase()
  return props.templates?.find(
    (template) =>
      template.id !== excludeId && template.name.trim().toLocaleLowerCase() === normalized,
  )
}

function requestSaveAsTemplate(): void {
  savingAsTemplate.value = true
  saveAsName.value = ''
}

function confirmSaveAsTemplate(): void {
  const name = saveAsName.value.trim()
  if (!name) return
  const duplicate = projectTemplateWithName(name)
  if (duplicate) {
    duplicateNameTarget.value = duplicate
    duplicateNameAction.value = 'saveAs'
    return
  }
  emit('saveAsTemplate', name, JSON.parse(JSON.stringify(draft.value)) as TextRenderConfig)
  savingAsTemplate.value = false
}

function confirmRename(): void {
  const template = renamingTemplate.value
  const name = renameDraft.value.trim()
  if (!template || !name) return
  const duplicate = projectTemplateWithName(name, template.id)
  if (duplicate) {
    duplicateNameTarget.value = duplicate
    duplicateNameAction.value = 'rename'
    return
  }
  emit('renameTemplate', template.id, name)
  renamingTemplate.value = undefined
}

function confirmDuplicateNameReplacement(): void {
  const target = duplicateNameTarget.value
  if (!target || !duplicateNameAction.value) return
  if (duplicateNameAction.value === 'saveAs') {
    emit(
      'saveAsTemplate',
      saveAsName.value.trim(),
      JSON.parse(JSON.stringify(draft.value)) as TextRenderConfig,
      target.id,
    )
    savingAsTemplate.value = false
  } else if (renamingTemplate.value) {
    emit('renameTemplate', renamingTemplate.value.id, renameDraft.value.trim(), target.id)
    renamingTemplate.value = undefined
  }
  duplicateNameTarget.value = undefined
  duplicateNameAction.value = undefined
}

function save(): void {
  if (editingTemplate.value) {
    emit(
      'saveTemplate',
      editingTemplate.value.name,
      JSON.parse(JSON.stringify(draft.value)) as TextRenderConfig,
      editingTemplate.value.id,
    )
    return
  }
  emit('save', JSON.parse(JSON.stringify(draft.value)) as TextRenderConfig)
}
</script>

<template>
  <Dialog :open="open" @update:open="(value) => !value && emit('close')">
    <DialogContent
      class="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-[1200px]"
      :show-close-button="false"
    >
      <DialogHeader class="shrink-0 border-b px-5 py-4">
        <DialogTitle>{{
          editingTemplate ? t('style.editTemplate') : t('style.title')
        }}</DialogTitle>
      </DialogHeader>
      <div class="shrink-0 border-b bg-card px-5 py-4">
        <div
          class="flex h-32 items-center justify-center overflow-hidden rounded border text-center"
        >
          <TextStyleCanvasPreview
            :text="previewText"
            :render="draft"
            :preview-background="previewBackground"
          />
        </div>
      </div>
      <div class="min-h-0 overflow-auto p-5">
        <div v-if="!editingTemplate" class="mb-5 flex gap-2" role="radiogroup">
          <Button
            type="button"
            size="sm"
            :variant="styleMode === 'template' ? 'default' : 'outline'"
            role="radio"
            :aria-checked="styleMode === 'template'"
            @click="setStyleMode('template')"
          >
            {{ t('style.templateMode') }}
          </Button>
          <Button
            type="button"
            size="sm"
            :variant="styleMode === 'individual' ? 'default' : 'outline'"
            role="radio"
            :aria-checked="styleMode === 'individual'"
            @click="setStyleMode('individual')"
          >
            {{ t('style.individualMode') }}
          </Button>
        </div>

        <section v-if="styleMode === 'template' && !editingTemplate">
          <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <ContextMenu v-for="template in availableTemplates" :key="template.id">
              <ContextMenuTrigger as-child>
                <button
                  type="button"
                  class="flex min-h-36 flex-col rounded border p-2 pb-4 text-left transition-colors hover:bg-accent"
                  :aria-label="template.name"
                  @click="selectTemplate(template.id)"
                >
                  <div
                    class="flex h-20 w-full items-center justify-center overflow-hidden rounded bg-muted/30"
                  >
                    <TextStyleCanvasPreview
                      :text="templatePreviewText"
                      :render="template.render"
                      :preview-background="previewBackground"
                    />
                  </div>
                  <span class="mt-3 block w-full truncate px-1 text-xs text-muted-foreground">
                    {{ template.name }}
                  </span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent v-if="templates?.some((item) => item.id === template.id)">
                <ContextMenuItem @select="editTemplate(template)">
                  {{ t('style.editTemplate') }}
                </ContextMenuItem>
                <ContextMenuItem @select="openRename(template)">
                  {{ t('style.renameTemplate') }}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  class="text-destructive"
                  @select="emit('deleteTemplate', template.id)"
                >
                  {{ t('style.deleteTemplate') }}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </section>

        <section v-else class="space-y-5">
          <div class="flex items-center justify-between gap-3">
            <p v-if="editingTemplate" class="text-sm text-muted-foreground">
              {{ editingTemplate.name }}
            </p>
            <span v-else />
            <Button
              v-if="!editingTemplate"
              variant="outline"
              size="sm"
              @click="requestSaveAsTemplate"
            >
              {{ t('style.saveAsTemplate') }}
            </Button>
          </div>
          <div class="grid grid-cols-4 gap-3">
            <FormField :label="t('style.fontFamily')"
              ><Input
                :model-value="draft.fontFamily"
                list="project-fonts"
                class="h-8 w-full rounded border bg-background px-2 text-foreground"
                @update:model-value="updateFontFamily"
            /></FormField>
            <FormField :label="t('style.projectFont')">
              <Select :model-value="selectedProjectFontId" @update:model-value="selectProjectFont">
                <SelectTrigger><SelectValue :placeholder="t('style.manualFont')" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem v-for="font in fonts" :key="font.id" :value="font.id">
                      {{ font.family }}{{ font.weight ? ` ${font.weight}` : '' }}
                      {{ font.style === 'normal' ? '' : ` · ${font.style}` }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormField>
            <datalist id="project-fonts">
              <option v-for="font in fonts" :key="font.id" :value="font.family">
                {{ font.family }}{{ font.subfamily ? ` · ${font.subfamily}` : '' }}
              </option>
            </datalist>
            <p class="col-span-full -mt-2 text-xs text-muted-foreground">
              {{ t('style.fontHint') }}
            </p>
            <div
              v-if="fonts?.length"
              class="col-span-full flex flex-wrap gap-1 text-xs text-muted-foreground"
            >
              <span v-for="font in fonts" :key="font.id" class="rounded border px-2 py-1">
                {{ font.family }}{{ font.weight ? ` ${font.weight}` : '' }} · {{ font.path }}
              </span>
            </div>
            <div
              v-if="fontDiagnostics?.length"
              class="col-span-full rounded border border-destructive/30 p-2 text-xs text-destructive"
            >
              <p class="font-medium">{{ t('style.fontDiagnostics') }}</p>
              <p v-for="diagnostic in fontDiagnostics" :key="diagnostic.path">
                {{ diagnostic.path }} · {{ diagnostic.message }}
              </p>
            </div>
            <FormField :label="t('style.fontSize')"
              ><Input
                v-model.number="draft.fontSize"
                class="h-8 w-full rounded border bg-background px-2 text-foreground"
                type="number"
                min="1"
            /></FormField>
            <FormField :label="t('style.lineHeight')"
              ><Input
                v-model.number="draft.lineHeight"
                class="h-8 w-full rounded border bg-background px-2 text-foreground"
                type="number"
                min="0.1"
                step="0.1"
            /></FormField>
            <FormField :label="t('translation.align')">
              <Select v-model="draft.align">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent
                  ><SelectGroup
                    ><SelectItem value="left">{{ t('translation.left') }}</SelectItem
                    ><SelectItem value="center">{{ t('translation.center') }}</SelectItem
                    ><SelectItem value="right">{{
                      t('translation.right')
                    }}</SelectItem></SelectGroup
                  ></SelectContent
                >
              </Select>
            </FormField>
            <FormField :label="t('style.verticalAlign')">
              <Select v-model="draft.verticalAlign">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent
                  ><SelectGroup>
                    <SelectItem value="top">{{ t('style.top') }}</SelectItem>
                    <SelectItem value="middle">{{ t('style.middle') }}</SelectItem>
                    <SelectItem value="bottom">{{ t('style.bottom') }}</SelectItem>
                  </SelectGroup></SelectContent
                >
              </Select>
            </FormField>
            <FormField :label="t('style.letterSpacing')">
              <Input v-model.number="draft.letterSpacing" type="number" step="0.1" />
            </FormField>
            <FormField :label="t('style.maxLines')">
              <Input v-model.number="draft.maxLines" type="number" min="1" />
            </FormField>
            <FormField :label="t('style.overflow')">
              <Select v-model="draft.overflow">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent
                  ><SelectGroup>
                    <SelectItem value="visible">{{ t('style.visible') }}</SelectItem>
                    <SelectItem value="clip">{{ t('style.clip') }}</SelectItem>
                    <SelectItem value="ellipsis">{{ t('style.ellipsis') }}</SelectItem>
                  </SelectGroup></SelectContent
                >
              </Select>
            </FormField>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="draft.wrap" type="checkbox" />
              {{ t('style.wrap') }}
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                :checked="Boolean(draft.autoFit)"
                type="checkbox"
                @change="setAutoFit(($event.target as HTMLInputElement).checked)"
              />
              {{ t('style.autoFit') }}
            </label>
            <FormField v-if="draft.autoFit" :label="t('style.minFontSize')">
              <Input v-model.number="draft.autoFit.minFontSize" type="number" min="1" />
            </FormField>
            <FormField v-if="draft.autoFit" :label="t('style.maxFontSize')">
              <Input v-model.number="draft.autoFit.maxFontSize" type="number" min="1" />
            </FormField>
          </div>
          <fieldset class="grid grid-cols-3 gap-3 rounded border p-3">
            <legend class="px-1 text-xs text-muted-foreground">{{ t('style.fill') }}</legend>
            <FormField :label="t('style.mode')"
              ><Select v-model="draft.fill!.mode"
                ><SelectTrigger><SelectValue /></SelectTrigger
                ><SelectContent
                  ><SelectGroup
                    ><SelectItem value="solid">{{ t('style.solid') }}</SelectItem
                    ><SelectItem value="transparent">{{ t('style.transparent') }}</SelectItem
                    ><SelectItem value="gradient">{{
                      t('style.gradient')
                    }}</SelectItem></SelectGroup
                  ></SelectContent
                ></Select
              ></FormField
            >
            <FormField :label="t('style.color')"
              ><input
                v-model="draft.fill!.color"
                class="h-8 w-full rounded border bg-background p-1"
                type="color"
            /></FormField>
            <FormField v-if="draft.fill!.mode === 'gradient'" :label="t('style.gradientEnd')"
              ><input
                v-model="draft.fill!.gradientEnd"
                class="h-8 w-full rounded border bg-background p-1"
                type="color"
            /></FormField>
            <FormField v-if="draft.fill!.mode === 'gradient'" :label="t('style.angle')"
              ><input
                v-model.number="draft.fill!.gradientAngle"
                class="h-8 w-full rounded border bg-background px-2 text-foreground"
                type="number"
            /></FormField>
            <FormField :label="t('style.alpha')"
              ><Slider
                :model-value="[draft.fill!.alpha ?? 1]"
                :min="0"
                :max="1"
                :step="0.01"
                @update:model-value="draft.fill!.alpha = $event?.[0] ?? 1"
            /></FormField>
            <FormField
              v-if="draft.fill!.mode === 'gradient'"
              :label="`${t('style.gradientEnd')} ${t('style.alpha')}`"
              ><Slider
                :model-value="[draft.fill!.gradientEndAlpha ?? 1]"
                :min="0"
                :max="1"
                :step="0.01"
                @update:model-value="draft.fill!.gradientEndAlpha = $event?.[0] ?? 1"
            /></FormField>
            <div v-if="draft.fill!.mode === 'gradient'" class="col-span-full space-y-2">
              <div
                v-for="(stop, index) in ensureGradientStops(draft.fill!)"
                :key="index"
                class="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2"
              >
                <span class="pb-2 text-xs text-muted-foreground">{{ index + 1 }}</span>
                <FormField :label="t('style.color')">
                  <input
                    v-model="stop.color"
                    class="h-8 w-full rounded border bg-background p-1"
                    type="color"
                  />
                </FormField>
                <FormField :label="t('style.stopPosition')">
                  <Input
                    :model-value="Math.round(stop.position * 100)"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    @update:model-value="updateGradientStopPosition(stop, $event)"
                  />
                </FormField>
                <FormField :label="t('style.alpha')">
                  <Slider
                    :model-value="[stop.alpha ?? 1]"
                    :min="0"
                    :max="1"
                    :step="0.01"
                    @update:model-value="stop.alpha = $event?.[0] ?? 1"
                  />
                </FormField>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="ensureGradientStops(draft.fill!).length <= 2"
                  @click="removeGradientStop(draft.fill!, index)"
                  >×</Button
                >
              </div>
              <Button variant="outline" size="sm" @click="addGradientStop(draft.fill!)">
                + {{ t('style.addStop') }}
              </Button>
            </div>
          </fieldset>
          <fieldset class="grid grid-cols-3 gap-3 rounded border p-3">
            <legend class="px-1 text-xs text-muted-foreground">{{ t('style.stroke') }}</legend>
            <FormField :label="t('style.width')"
              ><input
                v-model.number="draft.stroke!.width"
                class="h-8 w-full rounded border bg-background px-2 text-foreground"
                type="number"
                min="0"
            /></FormField>
            <FormField :label="t('style.position')"
              ><Select v-model="draft.stroke!.position"
                ><SelectTrigger><SelectValue /></SelectTrigger
                ><SelectContent
                  ><SelectGroup
                    ><SelectItem value="outside">{{ t('style.outside') }}</SelectItem
                    ><SelectItem value="inside">{{ t('style.inside') }}</SelectItem></SelectGroup
                  ></SelectContent
                ></Select
              ></FormField
            >
            <FormField :label="t('style.color')"
              ><input
                v-model="draft.stroke!.paint.color"
                class="h-8 w-full rounded border bg-background p-1"
                type="color"
            /></FormField>
            <FormField :label="t('style.mode')"
              ><Select v-model="draft.stroke!.paint.mode"
                ><SelectTrigger><SelectValue /></SelectTrigger
                ><SelectContent
                  ><SelectGroup
                    ><SelectItem value="solid">{{ t('style.solid') }}</SelectItem
                    ><SelectItem value="gradient">{{ t('style.gradient') }}</SelectItem
                    ><SelectItem value="transparent">{{
                      t('style.transparent')
                    }}</SelectItem></SelectGroup
                  ></SelectContent
                ></Select
              ></FormField
            >
            <FormField
              v-if="draft.stroke!.paint.mode === 'gradient'"
              :label="t('style.gradientEnd')"
              ><input
                v-model="draft.stroke!.paint.gradientEnd"
                class="h-8 w-full rounded border bg-background p-1"
                type="color"
            /></FormField>
            <FormField v-if="draft.stroke!.paint.mode === 'gradient'" :label="t('style.angle')"
              ><input
                v-model.number="draft.stroke!.paint.gradientAngle"
                class="h-8 w-full rounded border bg-background px-2 text-foreground"
                type="number"
            /></FormField>
            <FormField :label="t('style.alpha')"
              ><input
                v-model.number="draft.stroke!.paint.alpha"
                class="h-8 w-full"
                type="range"
                min="0"
                max="1"
                step="0.01"
            /></FormField>
            <FormField
              v-if="draft.stroke!.paint.mode === 'gradient'"
              :label="`${t('style.gradientEnd')} ${t('style.alpha')}`"
              ><input
                v-model.number="draft.stroke!.paint.gradientEndAlpha"
                class="h-8 w-full"
                type="range"
                min="0"
                max="1"
                step="0.01"
            /></FormField>
          </fieldset>
          <fieldset class="space-y-3 rounded border p-3">
            <legend class="px-1 text-xs text-muted-foreground">{{ t('style.shadow') }}</legend>
            <div
              v-for="(shadow, index) in ensureShadows()"
              :key="index"
              class="grid grid-cols-5 gap-2 items-end"
            >
              <FormField :label="t('style.color')"
                ><input
                  v-model="shadow.color"
                  class="h-8 w-full rounded border bg-background p-1"
                  type="color"
              /></FormField>
              <FormField :label="t('style.alpha')"
                ><Slider
                  :model-value="[shadow.alpha ?? 1]"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  @update:model-value="shadow.alpha = $event?.[0] ?? 1"
              /></FormField>
              <FormField :label="t('style.blur')"
                ><input
                  v-model.number="shadow.blur"
                  class="h-8 w-full rounded border bg-background px-2 text-foreground"
                  type="number"
                  min="0"
              /></FormField>
              <FormField :label="t('style.offsetX')"
                ><input
                  v-model.number="shadow.offsetX"
                  class="h-8 w-full rounded border bg-background px-2 text-foreground"
                  type="number"
              /></FormField>
              <div class="flex gap-1">
                <FormField :label="t('style.offsetY')"
                  ><input
                    v-model.number="shadow.offsetY"
                    class="h-8 w-full rounded border bg-background px-2 text-foreground"
                    type="number" /></FormField
                ><Button variant="outline" size="sm" @click="removeShadow(index)">×</Button>
              </div>
            </div>
            <Button variant="outline" size="sm" @click="addShadow"
              >+ {{ t('style.addShadow') }}</Button
            >
          </fieldset>
        </section>
      </div>
      <DialogFooter class="border-t px-5 py-3">
        <Button variant="outline" @click="emit('close')">{{ t('translation.cancel') }}</Button
        ><Button v-if="styleMode === 'individual' || editingTemplate" @click="save">{{
          t('common.ok')
        }}</Button>
      </DialogFooter>

      <Dialog
        :open="savingAsTemplate"
        @update:open="(value) => !value && (savingAsTemplate = false)"
      >
        <DialogContent class="sm:max-w-md" :show-close-button="false">
          <DialogHeader>
            <DialogTitle>{{ t('style.saveAsTemplate') }}</DialogTitle>
          </DialogHeader>
          <Input
            v-model="saveAsName"
            :placeholder="t('style.templateName')"
            @keydown.enter="confirmSaveAsTemplate"
          />
          <DialogFooter>
            <Button variant="outline" @click="savingAsTemplate = false">{{
              t('translation.cancel')
            }}</Button>
            <Button :disabled="!saveAsName.trim()" @click="confirmSaveAsTemplate">{{
              t('common.ok')
            }}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        :open="Boolean(renamingTemplate)"
        @update:open="(value) => !value && (renamingTemplate = undefined)"
      >
        <DialogContent class="sm:max-w-md" :show-close-button="false">
          <DialogHeader>
            <DialogTitle>{{ t('style.renameTemplate') }}</DialogTitle>
          </DialogHeader>
          <Input
            v-model="renameDraft"
            :placeholder="t('style.templateName')"
            @keydown.enter="confirmRename"
          />
          <DialogFooter>
            <Button variant="outline" @click="renamingTemplate = undefined">{{
              t('translation.cancel')
            }}</Button>
            <Button :disabled="!renameDraft.trim()" @click="confirmRename">{{
              t('common.ok')
            }}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog :open="Boolean(duplicateNameTarget)">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ t('style.templateNameConflictTitle') }}</AlertDialogTitle>
            <AlertDialogDescription>
              {{ t('style.templateNameConflict', { name: duplicateNameTarget?.name ?? '' }) }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel @click="duplicateNameTarget = undefined">{{
              t('translation.cancel')
            }}</AlertDialogCancel>
            <Button @click="confirmDuplicateNameReplacement">
              {{ t('style.overwriteTemplate') }}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContent>
  </Dialog>
</template>
