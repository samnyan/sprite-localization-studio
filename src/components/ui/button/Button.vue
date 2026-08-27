<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { buttonVariants, type ButtonVariants } from './variants'

defineOptions({ name: 'UiButton' })

withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant']
    size?: ButtonVariants['size']
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    class?: HTMLAttributes['class']
  }>(),
  {
    variant: 'default',
    size: 'default',
    type: 'button',
  },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="cn(buttonVariants({ variant, size }), $props.class)"
  >
    <slot />
  </button>
</template>
