<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { Moon, Sun } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

import { useTheme } from '@/app/composables/useTheme'
import { setLocale, type SupportedLocale } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from '@/components/ui/menubar'

const props = defineProps<{
  projectPath?: string
  canUndo?: boolean
  canRedo?: boolean
  canCopyTextRegion?: boolean
  canPasteTextRegion?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{
  newProject: []
  openProject: []
  saveProject: []
  undo: []
  redo: []
  copyTextRegion: []
  pasteTextRegion: []
}>()
const { locale, t } = useI18n()
const { theme, toggleTheme } = useTheme()

function changeLocale(event: Event): void {
  setLocale((event.target as HTMLSelectElement).value as SupportedLocale)
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

onMounted(() => window.addEventListener('keydown', handleShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleShortcut))
</script>

<template>
  <header class="flex h-9 shrink-0 items-center border-b bg-card px-1 text-xs select-none">
    <Menubar class="h-8 border-0 bg-transparent p-0 shadow-none">
      <span class="px-2 font-semibold">SLS</span>
      <MenubarMenu>
        <MenubarTrigger>{{ t('menu.file') }}</MenubarTrigger>
        <MenubarContent>
          <MenubarItem :disabled="busy" @select="emit('newProject')"
            >{{ t('menu.newProject') }}<MenubarShortcut>Ctrl+N</MenubarShortcut></MenubarItem
          >
          <MenubarItem :disabled="busy" @select="emit('openProject')"
            >{{ t('menu.openProject') }}<MenubarShortcut>Ctrl+O</MenubarShortcut></MenubarItem
          >
          <MenubarSeparator />
          <MenubarItem :disabled="busy || !projectPath" @select="emit('saveProject')"
            >{{ t('menu.save') }}<MenubarShortcut>Ctrl+S</MenubarShortcut></MenubarItem
          >
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>{{ t('menu.edit') }}</MenubarTrigger>
        <MenubarContent>
          <MenubarItem :disabled="busy || !canUndo" @select="emit('undo')"
            >{{ t('menu.undo') }}<MenubarShortcut>Ctrl+Z</MenubarShortcut></MenubarItem
          >
          <MenubarItem :disabled="busy || !canRedo" @select="emit('redo')"
            >{{ t('menu.redo') }}<MenubarShortcut>Ctrl+Y</MenubarShortcut></MenubarItem
          >
          <MenubarSeparator />
          <MenubarItem :disabled="busy || !canCopyTextRegion" @select="emit('copyTextRegion')"
            >{{ t('menu.copyTextRegion') }}<MenubarShortcut>Ctrl+C</MenubarShortcut></MenubarItem
          >
          <MenubarItem :disabled="busy || !canPasteTextRegion" @select="emit('pasteTextRegion')"
            >{{ t('menu.pasteTextRegion') }}<MenubarShortcut>Ctrl+V</MenubarShortcut></MenubarItem
          >
        </MenubarContent>
      </MenubarMenu>
      <span class="ml-2 truncate border-l pl-3 text-muted-foreground">{{
        projectPath || t('app.name')
      }}</span>
    </Menubar>
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
      <Button
        variant="ghost"
        size="icon"
        class="size-7"
        :aria-label="theme === 'dark' ? t('theme.light') : t('theme.dark')"
        :title="theme === 'dark' ? t('theme.light') : t('theme.dark')"
        @click="toggleTheme"
        ><Sun v-if="theme === 'dark'" /><Moon v-else
      /></Button>
    </div>
  </header>
</template>
