import { shallowRef } from 'vue'

export interface AlertOptions {
  title: string
  message: string
  confirmLabel: string
}

interface AlertRequest extends AlertOptions {
  resolve: () => void
}

const queue: AlertRequest[] = []
const currentAlert = shallowRef<AlertRequest>()

function showNext(): void {
  if (!currentAlert.value) currentAlert.value = queue.shift()
}

export function showAlert(options: AlertOptions): Promise<void> {
  return new Promise((resolve) => {
    queue.push({ ...options, resolve })
    showNext()
  })
}

export function closeAlert(): void {
  const request = currentAlert.value
  if (!request) return
  currentAlert.value = undefined
  request.resolve()
  showNext()
}

export function useAlertDialog() {
  return { currentAlert, closeAlert }
}
