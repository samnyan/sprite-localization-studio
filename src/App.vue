<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useWorkspaceShortcuts } from '@/app/composables/useWorkspaceShortcuts'
import { useWorkspaceStore } from '@/app/stores/workspace'
import AppMenuBar from '@/components/workspace/AppMenuBar.vue'
import AlertDialogHost from '@/components/ui/AlertDialogHost.vue'

const workspace = useWorkspaceStore()
const { t } = useI18n()
useWorkspaceShortcuts()

function newProject(): void {
  void workspace.createLocalProject(t('project.untitled'))
}
</script>

<template>
  <div class="flex h-screen min-w-[800px] flex-col overflow-hidden bg-background text-foreground">
    <AppMenuBar
      :project-path="workspace.directoryName"
      :can-undo="workspace.canUndo"
      :can-redo="workspace.canRedo"
      :busy="workspace.isBusy"
      @new-project="newProject"
      @open-project="workspace.openLocalProject"
      @save-project="workspace.saveProject"
      @undo="workspace.undo"
      @redo="workspace.redo"
    />
    <main class="flex min-h-0 flex-1">
      <RouterView />
    </main>
    <AlertDialogHost />
  </div>
</template>
