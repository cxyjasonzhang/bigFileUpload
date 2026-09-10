<template>
  <!-- 全屏模式：隐藏侧边栏/顶栏/Tab，内容区整页铺满（退出返回由全屏页面自身实现）
       覆盖 --art-full-height 为 100%，避免页面用「常规布局高度变量」导致与全屏内容区高度不匹配产生滚动条 -->
  <div v-if="isFullScreen" class="app-layout app-layout--fullscreen">
    <div class="layout-content layout-content--fullscreen" style="--art-full-height: 100%">
      <router-view v-if="isRefresh" v-slot="{ Component, route }">
        <keep-alive :include="visitedComponentNames">
          <component :is="Component" :key="route.path" class="art-page-view" />
        </keep-alive>
      </router-view>
    </div>
  </div>

  <!-- 常规布局：侧边栏 + 顶栏 + Tab + 内容区 -->
  <div v-else class="app-layout">
    <!-- 左侧可收缩侧栏 -->
    <AppSidebar />

    <!-- 右侧主区域：顶部栏 + 历史 Tab + 内容区 -->
    <div class="layout-main">
      <div id="app-header">
        <AppHeader />
        <AppTabs />
      </div>

      <div class="layout-content">
        <!-- 路由视图 + keep-alive：仅缓存「已访问列表」中的组件
             v-if="isRefresh" 配合 refreshKey 实现 Tab 右键刷新：短暂销毁再重建，组件重新挂载 -->
        <router-view v-if="isRefresh" v-slot="{ Component, route }" :style="contentStyle">
          <keep-alive :include="visitedComponentNames">
            <component :is="Component" :key="route.path" class="art-page-view" />
          </keep-alive>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import AppTabs from './AppTabs.vue'
import { useLayoutStore } from '@/stores/layout'
import { useAutoLayoutHeight } from '@/hooks/core/useLayoutHeight'

const route = useRoute()
const layout = useLayoutStore()

const { containerMinHeight, headerRef, contentHeaderRef } = useAutoLayoutHeight()

const contentStyle = computed((): CSSProperties => ({
  minHeight: containerMinHeight.value,
}))

// 当前路由是否全屏展示（来自动态路由 meta.isFullScreen）
const isFullScreen = computed(() => Boolean(route.meta.isFullScreen))

// keep-alive 的 :include 仅接收「已访问列表」内的组件名，
// 关闭 Tab（从列表移除）后对应组件自动从缓存驱逐
const visitedComponentNames = computed(() => layout.visitedRoutes.map((v) => v.component))

// Tab 刷新机制：watch refreshKey，短暂 v-if=false 再恢复，销毁再重建 router-view
const isRefresh = ref(true)

watch(
  () => layout.refreshKey,
  () => {
    isRefresh.value = false
    nextTick(() => {
      isRefresh.value = true
    })
  },
)

// 初始化布局：注册窄屏自动收起侧栏的监听（决策 10）
onMounted(() => {
  layout.initLayout()
})

// 全屏 ↔ 普通切换时，useAutoLayoutHeight 通过 getElementById 缓存的 headerRef 会指向
// 已销毁的旧 #app-header 节点，导致 --art-full-height 高度计算错误（普通页面残留滚动条）。
// 故切回普通模式时重新绑定 header 引用，强制触发高度重算。
watch(
  () => isFullScreen.value,
  (fs) => {
    if (fs) return
    requestAnimationFrame(() => {
      headerRef.value = document.getElementById('app-header') ?? undefined
      contentHeaderRef.value = document.getElementById('app-content-header') ?? undefined
    })
  },
)
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100%;
  /* 禁止 body 级滚动条，滚动统一收敛到内部内容区，避免全屏/常规切换时残留页面级滚动条 */
  overflow: hidden;
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
  background: var(--app-content-bg);
  min-height: 0;
}

/* 全屏模式：内容区铺满整个视口，无内边距
   页面通常为 art-full-height 定高布局，滚动由页面内部（JetTable 等）负责，
   故内容区 overflow:hidden，避免与页面高度 1px 不匹配产生内容区滚动条 */
.app-layout--fullscreen {
  display: block;
  height: 100%;
  overflow: hidden;
}

.layout-content--fullscreen {
  height: 100%;
  overflow: hidden;
  padding: 0;
}
</style>
