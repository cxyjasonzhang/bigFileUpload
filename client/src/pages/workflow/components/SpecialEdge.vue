<script setup lang="ts">
import { computed } from 'vue'
import { Position, Handle } from '@vue-flow/core'
import type { EdgeProps } from '@vue-flow/core'

const props = defineProps<EdgeProps>()

const x = computed(() => `${Math.round(props.sourceX)}px`)
const y = computed(() => `${Math.round(props.sourceY)}px`)
</script>

<template>
  <div class="vue-flow__node-default">
    <div>{{ data.label }}</div>

    <div>
      {{ x }} {{ y }}
    </div>

    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>
