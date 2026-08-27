<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";
import { checkVersion as checkIconCacheVersion } from "@/utils/iconCache";
import { useTheme } from "@/hooks/core/useTheme";

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

/* 布局内部统一管理滚动（常规页在 .layout-content，全屏页在 JetTable 内部），
   禁止 body/#app 层滚动条，避免全屏切换后残留页面级滚动条 */
#app {
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--app-bg);
}
</style>
