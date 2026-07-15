<template>
  <div class="app-layout">
    <!-- 左侧可收缩侧栏 -->
    <AppSidebar />

    <!-- 右侧主区域：顶部栏 + 历史 Tab + 内容区 -->
    <div class="layout-main">
      <AppHeader />
      <AppTabs />

      <div class="layout-content">
        <!-- 路由视图 + keep-alive：仅缓存「已访问列表」中的组件 -->
        <router-view v-slot="{ Component, route }">
          <keep-alive :include="visitedComponentNames">
            <component :is="Component" :key="route.path" />
          </keep-alive>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import AppSidebar from "./AppSidebar.vue";
import AppHeader from "./AppHeader.vue";
import AppTabs from "./AppTabs.vue";
import { useLayoutStore } from "@/stores/layout";

const layout = useLayoutStore();

// keep-alive 的 :include 仅接收「已访问列表」内的组件名，
// 关闭 Tab（从列表移除）后对应组件自动从缓存驱逐
const visitedComponentNames = computed(() =>
  layout.visitedRoutes.map((v) => v.component),
);

// 初始化布局：注册窄屏自动收起侧栏的监听（决策 10）
onMounted(() => {
  layout.initLayout();
});
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100%;
}

.layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.layout-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: #f0f2f5;
  min-height: 0;
}
</style>
