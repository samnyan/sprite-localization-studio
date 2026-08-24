<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Moon, Sun } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

import { setLocale, type SupportedLocale } from '@/app/i18n'
import { useTheme } from '@/app/composables/useTheme'

const props = defineProps<{
  projectName?: string
  busy?: boolean
}>()

const emit = defineEmits<{
  newProject: []
  openProject: []
}>()

const { locale, t } = useI18n()
const { theme, toggleTheme } = useTheme()
const fileMenu = ref<HTMLDetailsElement>()

function changeLocale(event: Event): void {
  setLocale((event.target as HTMLSelectElement).value as SupportedLocale)
}

function runMenuAction(action: 'new' | 'open'): void {
  fileMenu.value?.removeAttribute('open')

  if (action === 'new') {
    emit('newProject')
  } else {
    emit('openProject')
  }
}

function handleShortcut(event: KeyboardEvent): void {
  if (props.busy || (!event.ctrlKey && !event.metaKey)) return

  if (event.key.toLowerCase() === 'n') {
    event.preventDefault()
    emit('newProject')
  }

  if (event.key.toLowerCase() === 'o') {
    event.preventDefault()
    emit('openProject')
  }
}

function closeMenu(event: PointerEvent): void {
  if (!fileMenu.value?.contains(event.target as Node)) {
    fileMenu.value?.removeAttribute('open')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleShortcut)
  window.addEventListener('pointerdown', closeMenu)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcut)
  window.removeEventListener('pointerdown', closeMenu)
})
</script>

<template>
  <header class="flex h-9 shrink-0 items-center border-b bg-card px-1 text-xs select-none">
    <div class="flex min-w-0 items-center">
      <span class="px-2 font-semibold">SLS</span>

      <details ref="fileMenu" class="group relative">
        <summary class="cursor-default list-none rounded px-2 py-1.5 hover:bg-accent">
          {{ t('menu.file') }}
        </summary>
        <div class="absolute top-[calc(100%+3px)] left-0 z-50 w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
          <button
            type="button"
            class="flex w-full items-center rounded-sm px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50"
            :disabled="busy"
            @click="runMenuAction('new')"
          >
            {{ t('menu.newProject') }}
            <span class="ml-auto text-muted-foreground">Ctrl+N</span>
          </button>
          <button
            type="button"
            class="flex w-full items-center rounded-sm px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50"
            :disabled="busy"
            @click="runMenuAction('open')"
          >
            {{ t('menu.openProject') }}
            <span class="ml-auto text-muted-foreground">Ctrl+O</span>
          </button>
        </div>
      </details>

      <span class="ml-2 truncate border-l pl-3 text-muted-foreground">
        {{ projectName || t('app.name') }}
      </span>
    </div>

    <div class="ml-auto flex items-center gap-1">
      <label class="sr-only" for="app-language">{{ t('language.label') }}</label>
      <select
        id="app-language"
        :value="locale"
        class="h-7 rounded border-0 bg-transparent px-1.5 text-xs outline-none hover:bg-accent focus:bg-accent"
        @change="changeLocale"
      >
        <option value="en">{{ t('language.en') }}</option>
        <option value="zh-CN">{{ t('language.zhCN') }}</option>
      </select>

      <button
        type="button"
        class="flex size-7 items-center justify-center rounded hover:bg-accent"
        :aria-label="theme === 'dark' ? t('theme.light') : t('theme.dark')"
        :title="theme === 'dark' ? t('theme.light') : t('theme.dark')"
        @click="toggleTheme"
      >
        <Sun v-if="theme === 'dark'" class="size-4" aria-hidden="true" />
        <Moon v-else class="size-4" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>
