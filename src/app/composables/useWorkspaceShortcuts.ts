import { nextTick, onMounted, onUnmounted } from 'vue'

import { useWorkspaceStore } from '@/app/stores/workspace'

function isTextEditingTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true
  if (!(target instanceof HTMLInputElement)) return false
  return !['button', 'checkbox', 'color', 'file', 'radio', 'range', 'reset', 'submit'].includes(
    target.type,
  )
}

export function useWorkspaceShortcuts(): void {
  const workspace = useWorkspaceStore()

  async function handleKeydown(event: KeyboardEvent): Promise<void> {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    const key = event.key.toLowerCase()

    if (key === 's') {
      event.preventDefault()
      if (isTextEditingTarget(event.target)) event.target.blur()
      await nextTick()
      await workspace.saveProject()
      return
    }

    if (isTextEditingTarget(event.target)) return
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) workspace.redo()
      else workspace.undo()
    } else if (key === 'y') {
      event.preventDefault()
      workspace.redo()
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}
