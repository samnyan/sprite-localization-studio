<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { useWorkspaceShortcuts } from '@/app/composables/useWorkspaceShortcuts'
import { type LooseSpriteImportPreview, useWorkspaceStore } from '@/app/stores/workspace'
import AppMenuBar from '@/components/workspace/AppMenuBar.vue'
import LooseSpriteImportDialog from '@/components/workspace/LooseSpriteImportDialog.vue'
import AlertDialogHost from '@/components/ui/AlertDialogHost.vue'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'

const workspace = useWorkspaceStore()
const { t } = useI18n()
const looseSpriteImport = ref<LooseSpriteImportPreview>()
useWorkspaceShortcuts()

function newProject(): void {
  void workspace.createLocalProject(t('project.untitled'))
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
    <Toaster />
  </div>
</template>
