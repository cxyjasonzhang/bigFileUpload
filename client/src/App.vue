<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { checkVersion as checkIconCacheVersion } from "@/utils/iconCache";

// 图标缓存版本比对：不一致则清空本地缓存（仅启动调用一次）
onMounted(async () => {
  await checkIconCacheVersion();
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f0f2f5;
}
</style>
