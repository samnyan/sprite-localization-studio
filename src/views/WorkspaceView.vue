<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FilePlus2, FolderOpen, Image, Save } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

import { useWorkspaceStore } from '@/app/stores/workspace'
import { Button } from '@/components/ui/button'

const workspace = useWorkspaceStore()
const { t } = useI18n()
const projectName = ref(workspace.project?.name ?? '')
const saved = ref(false)

const errorText = computed(() => {
  if (!workspace.error) return ''
  return t(workspace.error.key, workspace.error.params ?? {})
})

const statusText = computed(() => {
  if (workspace.status === 'opening') return t('status.opening')
  if (workspace.status === 'saving') return t('status.saving')
  return t('status.ready')
})

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

async function saveProject(): Promise<void> {
  saved.value = await workspace.saveProjectName(projectName.value)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-muted/20">
    <div class="flex h-10 shrink-0 items-center gap-1 border-b bg-background px-2">
      <Button variant="ghost" size="sm" :disabled="workspace.isBusy" @click="newProject">
        <FilePlus2 class="size-4" aria-hidden="true" />
        {{ t('workspace.newProject') }}
      </Button>
      <Button variant="ghost" size="sm" :disabled="workspace.isBusy" @click="workspace.openLocalProject">
        <FolderOpen class="size-4" aria-hidden="true" />
        {{ t('workspace.openProject') }}
      </Button>
      <div class="mx-2 h-5 border-l"></div>
      <span class="truncate text-xs text-muted-foreground">
        {{ workspace.project?.name || t('toolbar.noProject') }}
      </span>
    </div>

    <div class="flex min-h-0 flex-1">
      <aside class="flex w-56 shrink-0 flex-col border-r bg-card">
        <div class="flex h-8 shrink-0 items-center border-b px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {{ t('panel.project') }}
        </div>
        <div class="min-h-0 flex-1 overflow-auto p-2 text-xs">
          <template v-if="workspace.project">
            <div class="rounded px-2 py-1.5 font-medium">{{ workspace.project.name }}</div>
            <div class="mt-1 px-2 py-1 text-muted-foreground">{{ t('panel.atlases') }}</div>
            <div
              v-for="atlasPath in workspace.project.atlasManifestPaths"
              :key="atlasPath"
              class="truncate rounded px-4 py-1.5 hover:bg-accent"
            >
              {{ atlasPath }}
            </div>
          </template>
          <p v-else class="px-2 py-3 text-muted-foreground">{{ t('panel.empty') }}</p>
        </div>
      </aside>

      <main class="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-workspace">
        <div v-if="!workspace.project" class="w-80 rounded-lg border bg-card p-6 text-center shadow-sm">
          <div class="mx-auto flex size-11 items-center justify-center rounded-md border bg-muted/50">
            <Image class="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 class="mt-4 text-base font-semibold">{{ t('workspace.emptyTitle') }}</h1>
          <p class="mt-1 text-sm text-muted-foreground">{{ t('workspace.emptyHint') }}</p>
          <div class="mt-5 flex justify-center gap-2">
            <Button :disabled="workspace.isBusy" @click="newProject">
              <FilePlus2 class="size-4" aria-hidden="true" />
              {{ t('workspace.newProject') }}
            </Button>
            <Button variant="outline" :disabled="workspace.isBusy" @click="workspace.openLocalProject">
              <FolderOpen class="size-4" aria-hidden="true" />
              {{ t('workspace.openProject') }}
            </Button>
          </div>
          <p v-if="errorText" class="mt-4 text-sm text-destructive" role="alert">{{ errorText }}</p>
        </div>

        <div v-else class="text-sm text-muted-foreground">{{ t('workspace.noSprite') }}</div>
      </main>

      <aside class="flex w-64 shrink-0 flex-col border-l bg-card">
        <div class="flex h-8 shrink-0 items-center border-b px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {{ t('panel.inspector') }}
        </div>

        <form v-if="workspace.project" class="space-y-4 p-3" @submit.prevent="saveProject">
          <p class="text-xs font-semibold">{{ t('project.settings') }}</p>
          <div>
            <label for="project-name" class="text-xs text-muted-foreground">{{ t('project.name') }}</label>
            <input
              id="project-name"
              v-model="projectName"
              class="mt-1 h-8 w-full rounded border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/30"
              autocomplete="off"
              @input="saved = false"
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
              <dd class="truncate">{{ workspace.project.targetLocales?.join(', ') || t('project.notSet') }}</dd>
            </div>
          </dl>
          <Button type="submit" size="sm" class="w-full" :disabled="workspace.isBusy">
            <Save class="size-3.5" aria-hidden="true" />
            {{ workspace.status === 'saving' ? t('project.saving') : t('project.save') }}
          </Button>
          <p v-if="saved && !errorText" class="text-center text-xs text-emerald-600">{{ t('project.saved') }}</p>
          <p v-if="errorText" class="text-xs text-destructive" role="alert">{{ errorText }}</p>
        </form>

        <p v-else class="p-3 text-xs text-muted-foreground">{{ t('panel.empty') }}</p>
      </aside>
    </div>

    <footer class="flex h-6 shrink-0 items-center border-t bg-card px-2 text-[11px] text-muted-foreground">
      <span>{{ statusText }}</span>
      <span v-if="workspace.directoryName" class="ml-auto truncate">{{ workspace.directoryName }}</span>
    </footer>
  </div>
</template>
