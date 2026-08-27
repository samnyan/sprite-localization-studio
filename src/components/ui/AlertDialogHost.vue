<script setup lang="ts">
import { useAlertDialog } from '@/app/services/alertDialog'
import { Button } from '@/components/ui/button'

const { currentAlert, closeAlert } = useAlertDialog()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="currentAlert"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        class="w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-message"
      >
        <h2 id="alert-dialog-title" class="font-semibold">{{ currentAlert.title }}</h2>
        <p id="alert-dialog-message" class="mt-2 text-sm text-muted-foreground">
          {{ currentAlert.message }}
        </p>
        <div class="mt-4 flex justify-end">
          <Button autofocus @click="closeAlert">{{ currentAlert.confirmLabel }}</Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
