<script setup lang="ts">
import { ChevronRight, Folder, FolderOpen, Image } from '@lucide/vue'

import type { TextureTreeNode as TextureTreeNodeModel } from '@/application/sprite-table/TextureTree'

defineOptions({ name: 'TextureTreeNode' })

const props = defineProps<{
  node: TextureTreeNodeModel
  depth: number
  expandedPaths: ReadonlySet<string>
  selectedDirectory?: string
  selectedSpriteId?: string
}>()
const emit = defineEmits<{
  toggle: [path: string]
  selectDirectory: [node: TextureTreeNodeModel]
  selectSprite: [node: TextureTreeNodeModel]
}>()

function toggle(): void {
  emit('toggle', props.node.path)
}

function select(): void {
  if (props.node.type === 'directory') {
    toggle()
    emit('selectDirectory', props.node)
  } else emit('selectSprite', props.node)
}
</script>

<template>
  <div>
    <button
      type="button"
      class="flex w-full items-center gap-1 rounded py-1 pr-2 text-left hover:bg-accent"
      :class="{
        'bg-accent':
          node.type === 'directory'
            ? selectedDirectory === node.path
            : selectedSpriteId === node.spriteId,
      }"
      :style="{ paddingLeft: `${8 + depth * 12}px` }"
      @click="select"
    >
      <ChevronRight
        v-if="node.type === 'directory'"
        class="size-3 shrink-0 transition-transform"
        :class="{ 'rotate-90': expandedPaths.has(node.path) }"
        aria-hidden="true"
        @click.stop="toggle"
      />
      <span v-else class="size-3 shrink-0" aria-hidden="true"></span>
      <FolderOpen
        v-if="node.type === 'directory' && expandedPaths.has(node.path)"
        class="size-3.5 shrink-0"
        aria-hidden="true"
      />
      <Folder v-else-if="node.type === 'directory'" class="size-3.5 shrink-0" aria-hidden="true" />
      <Image v-else class="size-3.5 shrink-0" aria-hidden="true" />
      <span class="truncate">{{ node.name }}</span>
    </button>
    <template v-if="node.type === 'directory' && expandedPaths.has(node.path)">
      <TextureTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :expanded-paths="expandedPaths"
        :selected-directory="selectedDirectory"
        :selected-sprite-id="selectedSpriteId"
        @toggle="emit('toggle', $event)"
        @select-directory="emit('selectDirectory', $event)"
        @select-sprite="emit('selectSprite', $event)"
      />
    </template>
  </div>
</template>
