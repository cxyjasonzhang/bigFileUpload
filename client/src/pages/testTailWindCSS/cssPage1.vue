<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
    <template v-for="item in feature" :key="'feature' + item">
      <div class="bg-sky-500 text-white text-center text-base border-1 border-black h-50">
        {{ item }}
      </div>
    </template>
    <!-- <div class="size-32">1</div> -->
    <!-- <div class="ize-32">2</div>
    <div class="ize-32">3</div>
    <div class="ize-32">4</div> -->
  </div>
</template>

<script setup>
import { ref } from 'vue'

const feature = ref(6)
</script>
