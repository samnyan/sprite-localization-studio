<script setup lang="ts">
import { ref } from 'vue'

import { useAlertDialog } from '@/app/services/alertDialog'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const { currentDialog, closeAlert, closeFileDialog } = useAlertDialog()
const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File>()

function selectFile(event: Event): void {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0]
}

function confirmFile(): void {
  closeFileDialog(selectedFile.value)
  selectedFile.value = undefined
}

function cancelFile(): void {
  closeFileDialog()
  selectedFile.value = undefined
}
</script>

<template>
  <AlertDialog :open="currentDialog?.kind === 'alert'">
    <AlertDialogContent v-if="currentDialog?.kind === 'alert'" class="max-w-sm">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ currentDialog.title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ currentDialog.message }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogAction autofocus @click="closeAlert">{{
          currentDialog.confirmLabel
        }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  <Dialog :open="currentDialog?.kind === 'file'" @update:open="(open) => !open && cancelFile()">
    <DialogContent
      v-if="currentDialog?.kind === 'file'"
      class="max-w-sm"
      :show-close-button="false"
    >
      <DialogHeader>
        <DialogTitle>{{ currentDialog.title }}</DialogTitle>
        <DialogDescription v-if="currentDialog.message">{{
          currentDialog.message
        }}</DialogDescription>
      </DialogHeader>
      <template v-if="currentDialog.kind === 'file'">
        <input
          ref="fileInput"
          class="sr-only"
          type="file"
          :accept="currentDialog.accept"
          @change="selectFile"
        />
        <div class="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" @click="fileInput?.click()">
            {{ selectedFile?.name ?? currentDialog.confirmLabel }}
          </Button>
          <DialogFooter class="flex-row gap-2 sm:justify-end">
            <Button variant="outline" @click="cancelFile">{{ currentDialog.cancelLabel }}</Button>
            <Button autofocus :disabled="!selectedFile" @click="confirmFile">{{
              currentDialog.confirmLabel
            }}</Button>
          </DialogFooter>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
