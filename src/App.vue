<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { useWorkspaceShortcuts } from '@/app/composables/useWorkspaceShortcuts'
import { type LooseSpriteImportPreview, useWorkspaceStore } from '@/app/stores/workspace'
import AppMenuBar from '@/components/workspace/AppMenuBar.vue'
import LooseSpriteImportDialog from '@/components/workspace/LooseSpriteImportDialog.vue'
import AlertDialogHost from '@/components/ui/AlertDialogHost.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'

const workspace = useWorkspaceStore()
const { t } = useI18n()
const looseSpriteImport = ref<LooseSpriteImportPreview>()
const projectRenameOpen = ref(false)
const projectRenameDraft = ref('')
let notifiedUpgradePaths = new Set<string>()
let notifiedUpgradeDirectory = ''
useWorkspaceShortcuts()

async function upgradeSpriteTables(): Promise<void> {
  const count = await workspace.upgradeSpriteTableManifests()
  if (count > 0) {
    toast.success(t('spriteTable.upgradeSuccess', { count }))
  }
}

watch(
  () => [workspace.directoryName, workspace.spriteTableUpgradePaths] as const,
  ([directory, paths]) => {
    if (directory !== notifiedUpgradeDirectory) {
      notifiedUpgradeDirectory = directory
      notifiedUpgradePaths = new Set()
    }
    const newPaths = paths.filter((path) => !notifiedUpgradePaths.has(path))
    if (!newPaths.length) return
    for (const path of newPaths) notifiedUpgradePaths.add(path)
    toast.info(t('spriteTable.upgradeAvailable'), {
      description: t('spriteTable.upgradeAvailableDescription', { count: newPaths.length }),
      action: {
        label: t('spriteTable.upgradeAction'),
        onClick: () => void upgradeSpriteTables(),
      },
    })
  },
  { deep: true },
)

function newProject(): void {
  void workspace.createLocalProject(t('project.untitled'))
}

function openProjectRename(): void {
  if (!workspace.project) return
  projectRenameDraft.value = workspace.project.name
  projectRenameOpen.value = true
}

async function renameProject(): Promise<void> {
  if (!workspace.saveProjectName(projectRenameDraft.value)) return
  if (await workspace.saveProject()) projectRenameOpen.value = false
}

async function prepareLooseSpriteImport(): Promise<void> {
  looseSpriteImport.value = await workspace.prepareLooseSpriteImport()
}

async function prepareScanTextures(): Promise<void> {
  looseSpriteImport.value = await workspace.prepareScanUnindexedTextures()
}

async function importLooseSprites(): Promise<void> {
  const preview = looseSpriteImport.value
  if (!preview) return
  const success =
    preview.mode === 'scan'
      ? await workspace.scanUnindexedProjectTextures()
      : await workspace.importPreparedLooseSprites()
  if (success) {
    toast.success(
      t(preview.mode === 'scan' ? 'spriteImport.scanSuccess' : 'spriteImport.success', {
        count: preview.imageCount,
      }),
      {
        description: t(
          preview.mode === 'scan'
            ? 'spriteImport.scanSuccessDescription'
            : 'spriteImport.successDescription',
          { directory: preview.directoryName },
        ),
      },
    )
  }
  workspace.cancelLooseSpriteImport()
  looseSpriteImport.value = undefined
}

function cancelLooseSpriteImport(): void {
  workspace.cancelLooseSpriteImport()
  looseSpriteImport.value = undefined
}
</script>

<template>
  <div class="flex h-screen min-w-[800px] flex-col overflow-hidden bg-background text-foreground">
    <AppMenuBar
      :project-path="workspace.directoryName"
      :project-name="workspace.project?.name"
      :can-undo="workspace.canUndo"
      :can-redo="workspace.canRedo"
      :can-copy-text-region="workspace.canCopyTextRegion"
      :can-paste-text-region="workspace.canPasteTextRegion"
      :busy="workspace.isBusy"
      @new-project="newProject"
      @open-project="workspace.openLocalProject"
      @import-sprites="prepareLooseSpriteImport"
      @scan-textures="prepareScanTextures"
      @save-project="workspace.saveProject"
      @undo="workspace.undo"
      @redo="workspace.redo"
      @copy-text-region="workspace.copyTextRegion"
      @paste-text-region="workspace.pasteTextRegion"
      @rename-project="openProjectRename"
    />
    <main class="flex min-h-0 flex-1">
      <RouterView />
    </main>
    <AlertDialogHost />
    <LooseSpriteImportDialog
      :open="looseSpriteImport !== undefined"
      :preview="looseSpriteImport"
      :busy="workspace.isBusy"
      @confirm="importLooseSprites"
      @cancel="cancelLooseSpriteImport"
    />
    <Dialog v-model:open="projectRenameOpen">
      <DialogContent class="sm:max-w-md" :show-close-button="false">
        <DialogHeader
          ><DialogTitle>{{ t('project.rename') }}</DialogTitle></DialogHeader
        >
        <Input
          v-model="projectRenameDraft"
          :aria-label="t('project.name')"
          @keyup.enter="renameProject"
        />
        <DialogFooter>
          <Button variant="outline" @click="projectRenameOpen = false">{{
            t('common.cancel')
          }}</Button>
          <Button
            :disabled="!projectRenameDraft.trim() || workspace.isBusy"
            data-testid="confirm-project-rename"
            @click="renameProject"
            >{{ t('common.save') }}</Button
          >
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Toaster />
  </div>
</template>
