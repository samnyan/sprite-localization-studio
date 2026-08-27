<script setup lang="ts">
import { Label } from '@/components/ui/label'

defineProps<{ label: string }>()
</script>

<template>
  <div class="grid gap-1">
    <Label class="text-xs text-muted-foreground"
      ><span>{{ label }}</span></Label
    >
    <slot />
  </div>
</template>
