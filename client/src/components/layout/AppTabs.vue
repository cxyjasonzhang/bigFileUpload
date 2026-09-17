<template>
  <!-- 历史 Tab 栏：展示 visitedRoutes，支持点击切换、关闭、右键菜单 -->
  <div class="app-tabs">
    <el-tag
      v-for="tag in layout.visitedRoutes"
      :key="tag.path"
      :type="route.path === tag.path ? 'primary' : 'info'"
      :closable="!tag.pinned"
      class="app-tab-tag"
      @click="handleTabClick(tag)"
      @close="handleTabClose(tag)"
      @contextmenu.prevent="handleContextMenu($event, tag)"
    >
      {{ tag.title }}
    </el-tag>

    <!-- 右键菜单组件（右键 Tab 和右侧下拉图标共用） -->
    <JetMenuRight
      ref="menuRef"
      :menu-items="contextMenuItems"
      :menu-width="140"
      @select="handleMenuSelect"
    />

    <!-- 右侧下拉触发图标：点击以当前激活 Tab 为目标弹出菜单 -->
    <span
      v-if="layout.visitedRoutes.length > 0"
      class="tab-dropdown-trigger"
      @click="handleDropdownClick"
    >
      <SvgIcon name="sys/arrow_down" :size="14" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLayoutStore } from '@/stores/layout'
import type { VisitedRoute } from '@/stores/layout'
import JetMenuRight from '@/components/others/jet-menu-right/index.vue'
import type { MenuItemType } from '@/components/others/jet-menu-right/index.vue'

const route = useRoute()
const router = useRouter()
const layout = useLayoutStore()

/** JetMenuRight 组件引用 */
const menuRef = ref<InstanceType<typeof JetMenuRight> | null>(null)

/** 当前操作的 Tab（右键时记录右键目标，下拉时设为激活 Tab） */
const currentRightClickTag = ref<VisitedRoute | null>(null)

/** 处理 Tab 点击：切换到对应路由 */
function handleTabClick(tag: VisitedRoute) {
  console.log('[DEBUG-nav] Tab 点击:', tag.path, '当前:', route.path)
  if (tag.path !== route.path) {
    router.push(tag.path)
  }
}

/** 处理 Tab 关闭按钮 */
function handleTabClose(tag: VisitedRoute) {
  layout.removeVisited(tag.path)
  if (tag.path === route.path) {
    const idx = layout.visitedRoutes.findIndex((v: VisitedRoute) => v.path === tag.path)
    if (idx === -1) {
      const last = layout.visitedRoutes[layout.visitedRoutes.length - 1]
      if (last) router.push(last.path)
    }
  }
}

/** 处理右键事件：记录当前 Tab 并显示菜单 */
function handleContextMenu(e: MouseEvent, tag: VisitedRoute) {
  currentRightClickTag.value = tag
  menuRef.value?.show(e)
}

/** 处理下拉图标点击：以当前激活 Tab 为目标弹出菜单 */
function handleDropdownClick(e: MouseEvent) {
  const tag = layout.visitedRoutes.find((v: VisitedRoute) => v.path === route.path)
  if (!tag) return
  currentRightClickTag.value = tag
  menuRef.value?.show(e)
}

/** 当前操作 Tab 是否已固定 */
const isPinned = computed(() => currentRightClickTag.value?.pinned ?? false)

/** 当前操作 Tab 是否为当前激活页 */
const isActive = computed(() => currentRightClickTag.value?.path === route.path)

/** 当前操作 Tab 在 visitedRoutes 中的索引 */
const tagIndex = computed(() => {
  if (!currentRightClickTag.value) return -1
  return layout.visitedRoutes.findIndex(
    (v: VisitedRoute) => v.path === currentRightClickTag.value!.path,
  )
})

/** 右侧是否有可关闭的 Tab */
const hasClosableRight = computed(() => {
  if (tagIndex.value === -1) return false
  return layout.visitedRoutes.slice(tagIndex.value + 1).some((v: VisitedRoute) => !v.pinned)
})

/** 左侧是否有可关闭的 Tab */
const hasClosableLeft = computed(() => {
  if (tagIndex.value <= 0) return false
  return layout.visitedRoutes.slice(0, tagIndex.value).some((v: VisitedRoute) => !v.pinned)
})

/** 除当前 + pinned 外是否还有其他可关闭的 Tab */
const hasOtherClosable = computed(() => {
  if (!currentRightClickTag.value) return false
  return layout.visitedRoutes.some(
    (v: VisitedRoute) => !v.pinned && v.path !== currentRightClickTag.value!.path,
  )
})

/** 除 pinned 外是否有可关闭的 Tab */
const hasAnyClosable = computed(() => layout.visitedRoutes.some((v: VisitedRoute) => !v.pinned))

/** 菜单项：根据 currentRightClickTag 状态动态生成（右键和下拉复用同一套） */
const contextMenuItems = computed<MenuItemType[]>(() => [
  {
    key: 'refresh',
    icon: 'sys/refresh',
    label: '刷新',
    disabled: !isActive.value,
  },
  {
    key: 'pin',
    icon: 'sys/fixed',
    label: isPinned.value ? '取消固定' : '固定',
    disabled: currentRightClickTag.value?.path === '/workbench',
  },
  {
    key: 'close-left',
    icon: 'sys/arrow_left',
    label: '关闭左侧',
    disabled: !hasClosableLeft.value,
  },
  {
    key: 'close-right',
    icon: 'sys/arrow_right',
    label: '关闭右侧',
    disabled: !hasClosableRight.value,
    showLine: true,
  },
  {
    key: 'close-others',
    icon: 'ai/关闭',
    label: '关闭其他',
    disabled: !hasOtherClosable.value,
  },
  {
    key: 'close-all',
    icon: 'sys/close_border',
    label: '关闭全部',
    disabled: !hasAnyClosable.value,
  },
])

/** 处理菜单项点击 */
function handleMenuSelect(item: MenuItemType) {
  const tag = currentRightClickTag.value
  if (!tag) return

  switch (item.key) {
    case 'refresh':
      layout.triggerRefresh()
      break

    case 'pin':
      if (tag.pinned) {
        layout.unpinVisited(tag.path)
      } else {
        layout.pinVisited(tag.path)
      }
      break

    case 'close-left':
      layout.closeLeftVisited(tag.path)
      if (!layout.visitedRoutes.some((v: VisitedRoute) => v.path === route.path)) {
        router.push(tag.path)
      }
      break

    case 'close-right':
      layout.closeRightVisited(tag.path)
      break

    case 'close-others':
      layout.closeOtherVisited(tag.path)
      if (!layout.visitedRoutes.some((v: VisitedRoute) => v.path === route.path)) {
        router.push(tag.path)
      }
      break

    case 'close-all': {
      layout.closeAllVisited()
      const first = layout.visitedRoutes[0]
      if (first) router.push(first.path)
      break
    }
  }
}
</script>

<style scoped>
.app-tabs {
  height: 40px;
  flex-shrink: 0;
  background: var(--app-tab-bg);
  border-bottom: 1px solid var(--app-tab-border);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  overflow-x: auto;
}

.app-tab-tag {
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
}

.tab-dropdown-trigger {
  flex-shrink: 0;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--app-text-regular);
}

.tab-dropdown-trigger:hover {
  background: var(--app-tab-close-hover-bg);
}
</style>
