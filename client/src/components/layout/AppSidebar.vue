<template>
  <div class="sidebar" :class="{ 'is-collapsed': collapsed }">
    <div class="sidebar-logo">
      <span v-if="!collapsed">大文件上传系统</span>
      <span v-else>大</span>
    </div>

    <el-menu
      :default-active="route.path"
      :collapse="collapsed"
      :collapse-transition="false"
      class="sidebar-menu"
      @select="handleSelect"
    >
      <!-- 动态菜单树：目录（menuType=0）渲染为子菜单，菜单（menuType=1）渲染为菜单项 -->
      <template v-for="item in menuTree" :key="item.menuId">
        <!-- 目录：有子级时渲染为 el-sub-menu，否则退化为菜单项 -->
        <el-sub-menu
          v-if="item.menuType === 0 && item.children?.length"
          :index="String(item.menuId)"
        >
          <template #title>
            <!-- 用 el-icon 包裹 SvgIcon：折叠时 el-menu--collapse 依赖 [class^=el-icon] 识别并显示图标 -->
            <el-icon v-if="item.icon" class="menu-icon">
              <SvgIcon :name="item.icon" color="currentColor" />
            </el-icon>
            <span>{{ item.menuName }}</span>
          </template>
          <template v-for="child in item.children" :key="child.menuId">
            <el-menu-item v-if="child.menuType === 1" :index="child.path">
              <el-icon v-if="child.icon" class="menu-icon">
                <SvgIcon :name="child.icon" color="currentColor" />
              </el-icon>
              <template #title>{{ child.menuName }}</template>
            </el-menu-item>
          </template>
        </el-sub-menu>

        <!-- 菜单（或没有子级的目录）：直接渲染为菜单项 -->
        <el-menu-item v-else-if="item.menuType === 1 || !item.children?.length" :index="item.path">
          <el-icon v-if="item.icon" class="menu-icon">
            <SvgIcon :name="item.icon" color="currentColor" />
          </el-icon>
          <template #title>{{ item.menuName }}</template>
        </el-menu-item>
      </template>
    </el-menu>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useLayoutStore } from '@/stores/layout'
import { usePermissionStore } from '@/stores/permission'

const route = useRoute()
const router = useRouter()
const layout = useLayoutStore()
const permission = usePermissionStore()
const { collapsed } = storeToRefs(layout)
const { menuTree } = storeToRefs(permission)

// 菜单点击 → 路由导航（菜单项的 index 即路由 path）
function handleSelect(index: string) {
  console.log('[DEBUG-nav] 侧边栏菜单点击:', index)
  if (index.startsWith('/')) {
    router.push(index)
  }
}
</script>

<style scoped>
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--app-sidebar-bg);
  color: var(--app-text-primary);
  display: flex;
  flex-direction: column;
  transition: width 0.2s;
  overflow: hidden;
}

.sidebar.is-collapsed {
  width: 64px;
}

.sidebar-logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text-primary);
  white-space: nowrap;
  border-bottom: 1px solid var(--app-border);
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  background: transparent;
}

.sidebar-menu :deep(.el-menu-item),
.sidebar-menu :deep(.el-sub-menu__title) {
  color: var(--app-text-regular);
}

.menu-icon {
  margin-right: 8px;
  font-size: 16px;
  width: 16px;
  height: 16px;
  /* 让内部 SvgIcon 跟随当前文字颜色，hover/active 时随父级变色 */
  color: inherit;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  color: var(--el-color-primary);
  background: var(--app-menu-active-bg);
}

.sidebar-menu :deep(.el-menu-item:hover),
.sidebar-menu :deep(.el-sub-menu__title:hover) {
  background: var(--app-menu-hover-bg);
}

/* 折叠态：el-menu--collapse 依赖 el-icon 显示图标，这里确保 svg 填满容器 */
.sidebar-menu :deep(.menu-icon svg) {
  width: 16px;
  height: 16px;
}

.sidebar-menu :deep(.el-menu--popup .menu-icon) {
  width: 16px;
  height: 16px;
}
</style>
