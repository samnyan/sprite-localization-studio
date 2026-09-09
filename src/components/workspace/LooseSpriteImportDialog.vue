<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { LooseSpriteImportPreview } from '@/app/stores/workspace'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const props = defineProps<{
  open: boolean
  preview?: LooseSpriteImportPreview
  busy?: boolean
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const { t } = useI18n()

function handleOpenChange(open: boolean): void {
  if (!open && !props.busy) emit('cancel')
}
</script>

<template>
  <AlertDialog :open="open" @update:open="handleOpenChange">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ t(preview?.mode === 'scan' ? 'spriteImport.scanTitle' : 'spriteImport.title') }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{
            t(
              preview?.mode === 'scan'
                ? 'spriteImport.scanDescription'
                : 'spriteImport.description',
              {
                count: preview?.imageCount ?? 0,
                directory: preview?.directoryName ?? '',
              },
            )
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <p class="text-sm text-muted-foreground">
        {{
          t(
            preview?.mode === 'scan' ? 'spriteImport.scanDestination' : 'spriteImport.destination',
            { directory: preview?.directoryName ?? '' },
          )
        }}
      </p>
      <AlertDialogFooter>
        <Button variant="outline" :disabled="busy" @click="emit('cancel')">
          {{ t('translation.cancel') }}
        </Button>
        <Button :disabled="busy" @click="emit('confirm')">
          <Spinner v-if="busy" />
          {{
            t(preview?.mode === 'scan' ? 'spriteImport.scanConfirm' : 'spriteImport.confirm', {
              count: preview?.imageCount ?? 0,
            })
          }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
