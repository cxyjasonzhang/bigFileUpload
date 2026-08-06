<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { checkVersion as checkIconCacheVersion } from "@/utils/iconCache";
import { useTheme } from "@/composables/useTheme";

// 图标缓存版本比对：不一致则清空本地缓存（仅启动调用一次）
onMounted(async () => {
  await checkIconCacheVersion();
});

// 主题初始化：监听 mode/primaryColor 变化，自动切换 html.dark 并注入主题色 CSS 变量
useTheme();
</script>

<style>
html,
body,
#app {
  height: 100%;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--app-bg);
}
</style>
