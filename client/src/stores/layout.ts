// 布局与「已访问路由（历史 Tab）」状态管理
// 仅承载外壳视图状态，不承载任何业务状态
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface VisitedRoute {
  /** 路由路径，唯一标识 */
  path: string
  /** 路由 name，同时作为 keep-alive 的组件缓存 key */
  name: string
  /** Tab 显示标题 */
  title: string
  /** 组件 name，供 keep-alive :include 使用 */
  component: string
  /** 是否固定（工作台固定，不可关闭） */
  pinned: boolean
}

const WORKBENCH: VisitedRoute = {
  path: '/workbench',
  name: 'Workbench',
  title: '工作台',
  component: 'Workbench',
  pinned: true,
}

export const useLayoutStore = defineStore(
  'layout',
  () => {
    // 侧栏是否收起
    const collapsed = ref(false)
    // 已访问路由列表（历史 Tab）
    const visitedRoutes = ref<VisitedRoute[]>([{ ...WORKBENCH }])
    // 主题模式：浅色 | 暗色
    const mode = ref<'light' | 'dark'>('light')
    // 主题色
    const primaryColor = ref('#5D87FF')
    // Tab 刷新计数器（AppTabs 右键刷新时 ++，AppLayout watch 它重建 router-view）
    const refreshKey = ref(0)

    /** 补入一条已访问路由，已存在则跳过 */
    function addVisited(route: VisitedRoute) {
      if (visitedRoutes.value.some((v) => v.path === route.path)) return
      visitedRoutes.value.push(route)
    }

    /** 从已访问列表移除某路由（pinned 不可移除） */
    function removeVisited(path: string) {
      const idx = visitedRoutes.value.findIndex((v) => v.path === path)
      if (idx === -1) return
      if (visitedRoutes.value[idx].pinned) return
      visitedRoutes.value.splice(idx, 1)
    }

    function toggleSidebar() {
      collapsed.value = !collapsed.value
    }

    function setSidebar(v: boolean) {
      collapsed.value = v
    }

    /** 设置主题模式 */
    function setMode(m: 'light' | 'dark') {
      mode.value = m
    }

    /** 设置主题色 */
    function setPrimaryColor(color: string) {
      primaryColor.value = color
    }

    /** 固定某个 Tab（使其不可关闭） */
    function pinVisited(path: string) {
      const found = visitedRoutes.value.find((v) => v.path === path)
      if (found) found.pinned = true
    }

    /** 取消固定某个 Tab */
    function unpinVisited(path: string) {
      const found = visitedRoutes.value.find((v) => v.path === path)
      if (found) found.pinned = false
    }

    /** 触发 Tab 刷新（AppLayout watch 此值重建 router-view） */
    function triggerRefresh() {
      refreshKey.value++
    }

    /** 关闭左侧 Tab（保留 pinned 和当前 Tab） */
    function closeLeftVisited(path: string) {
      const idx = visitedRoutes.value.findIndex((v) => v.path === path)
      if (idx === -1) return
      visitedRoutes.value = visitedRoutes.value.filter((v, i) => v.pinned || i >= idx)
    }

    /** 关闭右侧 Tab（保留 pinned 和当前 Tab） */
    function closeRightVisited(path: string) {
      const idx = visitedRoutes.value.findIndex((v) => v.path === path)
      if (idx === -1) return
      visitedRoutes.value = visitedRoutes.value.filter((v, i) => v.pinned || i <= idx)
    }

    /** 关闭其他 Tab（保留 pinned 和当前 Tab） */
    function closeOtherVisited(path: string) {
      visitedRoutes.value = visitedRoutes.value.filter((v) => v.pinned || v.path === path)
    }

    /** 关闭全部 Tab（仅保留 pinned） */
    function closeAllVisited() {
      visitedRoutes.value = visitedRoutes.value.filter((v) => v.pinned)
    }

    // 决策 10：窄屏（<768px）自动收起侧栏；宽屏不强制展开，保留用户显式选择
    function initLayout() {
      const mql = window.matchMedia('(max-width: 768px)')
      const apply = () => {
        if (mql.matches) collapsed.value = true
      }
      apply()
      mql.addEventListener('change', apply)
    }

    return {
      collapsed,
      visitedRoutes,
      mode,
      primaryColor,
      refreshKey,
      addVisited,
      removeVisited,
      toggleSidebar,
      setSidebar,
      setMode,
      setPrimaryColor,
      pinVisited,
      unpinVisited,
      triggerRefresh,
      closeLeftVisited,
      closeRightVisited,
      closeOtherVisited,
      closeAllVisited,
      initLayout,
    }
  },
  {
    persist: {
      key: 'layout-store',
      // 仅持久化外壳视图状态，不持久化业务数据
      paths: ['collapsed', 'visitedRoutes', 'mode', 'primaryColor'],
    },
  },
)
