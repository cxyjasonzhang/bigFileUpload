// 路由表：静态路由（login / 布局壳 / 404）+ 动态菜单路由（addRoute 注入）
// 鉴权由 beforeEach 守卫统一处理；动态菜单在登录后按角色下发并动态注册
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { authState } from '@/utils/auth'
import { useLayoutStore } from '@/stores/layout'

// 扩展 vue-router 的 RouteMeta，支持自定义元信息字段
declare module 'vue-router' {
  interface RouteMeta {
    /** 是否为公开路由（无需登录） */
    public?: boolean
    /** 页面标题（用于历史 Tab 显示） */
    title?: string
    /** 组件名（用于 keep-alive :include 缓存匹配） */
    componentName?: string
    /** 是否全屏展示：打开时隐藏侧边栏/顶栏/Tab，整页独立展示 */
    isFullScreen?: boolean
  }
}

// 布局壳（动态路由的父级）
const Layout = () => import('@/components/layout/AppLayout.vue')

/**
 * 静态路由：登录页、布局壳（挂载动态子路由）、404 兜底
 * 业务页面不再静态声明，统一由后端菜单下发后动态注册
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/login/index.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/testcss',
    name: 'testcss1',
    component: () => import('@/pages/testTailWindCSS/cssPage1.vue'),
    meta: { public: true, title: '测试css' },
  },
  {
    path: '/',
    name: 'Layout',
    component: Layout,
    redirect: '/workbench',
    children: [
      {
        path: '/workbench',
        name: 'Workbench',
        component: () => import('@/pages/workbench/index.vue'),
        meta: { title: '工作台' },
      },
    ],
  },
  // 兜底：未知路径 → 404（动态路由未覆盖到的地址都落到这里）
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/pages/exception/404/index.vue'),
    meta: { public: true, title: '404' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ─── 鉴权守卫：未登录访问受保护路由 → 重定向 /login 并携带回跳地址 ───
router.beforeEach((to) => {
  const isPublic = Boolean(to.meta.public)
  // 已登录还想去 /login → 直接进工作台
  if (to.path === '/login' && authState.isLoggedIn) {
    console.warn('[DEBUG-logout] 守卫拦截：已登录访问 /login → 弹回 workbench', {
      from: router.currentRoute.value.fullPath,
      to: to.fullPath,
    })
    return { path: '/workbench' }
  }
  if (!isPublic && !authState.isLoggedIn) {
    console.log('[DEBUG-logout] 守卫放行到登录页：未登录访问受保护路由', to.fullPath)
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login') {
    console.log('[DEBUG-logout] 守卫放行：访问 /login（isLoggedIn = false）')
  }
  return true
})

// ─── 导航完成后：把当前受保护路由补入「已访问列表」（去重）───
router.afterEach((to) => {
  if (to.meta.public) return
  const layout = useLayoutStore()
  layout.addVisited({
    path: to.path,
    name: String(to.name ?? to.path),
    title: (to.meta.title as string) ?? to.path,
    component: (to.meta.componentName as string) ?? String(to.name),
    pinned: to.path === '/workbench',
  })
})

export default router

// 主页路径, 默认使用菜单中第一个有效路径
export const HOME_PAGE_PATH = ''
