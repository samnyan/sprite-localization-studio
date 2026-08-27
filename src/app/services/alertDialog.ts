import { shallowRef } from 'vue'

export interface AlertOptions {
  title: string
  message: string
  confirmLabel: string
}

export interface FileDialogOptions {
  title: string
  message?: string
  confirmLabel: string
  cancelLabel: string
  accept?: string
}

type DialogRequest =
  | (AlertOptions & { kind: 'alert'; resolve: () => void })
  | (FileDialogOptions & { kind: 'file'; resolve: (file?: File) => void })

const queue: DialogRequest[] = []
const currentDialog = shallowRef<DialogRequest>()

function showNext(): void {
  if (!currentDialog.value) currentDialog.value = queue.shift()
}

export function showAlert(options: AlertOptions): Promise<void> {
  return new Promise((resolve) => {
    queue.push({ ...options, kind: 'alert', resolve })
    showNext()
  })
}

export function showFileDialog(options: FileDialogOptions): Promise<File | undefined> {
  return new Promise((resolve) => {
    queue.push({ ...options, kind: 'file', resolve })
    showNext()
  })
}

export function closeAlert(): void {
  const request = currentDialog.value
  if (!request || request.kind !== 'alert') return
  currentDialog.value = undefined
  request.resolve()
  showNext()
}

export function closeFileDialog(file?: File): void {
  const request = currentDialog.value
  if (!request || request.kind !== 'file') return
  currentDialog.value = undefined
  request.resolve(file)
  showNext()
}

export function useAlertDialog() {
  return { currentDialog, closeAlert, closeFileDialog }
}
