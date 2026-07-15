// 路由表：嵌套路由 + 历史 Tab 模型（Pattern A）
//   /login          公开路由（无外壳，登录页）
//   /        (AppLayout 外壳) ── 子路由 /workbench /upload /users /icons
// 鉴权由 beforeEach 守卫统一处理；afterEach 把受保护路由补入「已访问列表」
import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { authState } from "@/utils/auth";
import { useLayoutStore } from "@/stores/layout";

// 扩展 vue-router 的 RouteMeta，支持自定义元信息字段
declare module "vue-router" {
  interface RouteMeta {
    /** 是否为公开路由（无需登录） */
    public?: boolean;
    /** 页面标题（用于历史 Tab 显示） */
    title?: string;
    /** 组件名（用于 keep-alive :include 缓存匹配） */
    componentName?: string;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/pages/login/index.vue"),
    meta: { public: true, title: "登录" },
  },
  {
    path: "/",
    component: () => import("@/components/layout/AppLayout.vue"),
    redirect: "/workbench",
    children: [
      {
        path: "workbench",
        name: "Workbench",
        component: () => import("@/pages/workbench/index.vue"),
        meta: { title: "工作台", componentName: "Workbench" },
      },
      {
        path: "upload",
        name: "FileUpload",
        component: () => import("@/pages/fileUpload/index.vue"),
        meta: { title: "文件上传", componentName: "FileUpload" },
      },
      {
        path: "users",
        name: "UserManagement",
        component: () => import("@/pages/userManagement/index.vue"),
        meta: { title: "用户管理", componentName: "UserManagement" },
      },
      {
        path: "icons",
        name: "IconManager",
        component: () => import("@/pages/iconManager/index.vue"),
        meta: { title: "图标管理", componentName: "IconManager" },
      },
    ],
  },
  // 兜底：未知路径回到工作台
  { path: "/:pathMatch(.*)*", redirect: "/workbench" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// ─── 鉴权守卫：未登录访问受保护路由 → 重定向 /login 并携带回跳地址 ───
router.beforeEach((to) => {
  const isPublic = Boolean(to.meta.public);
  // 已登录还想去 /login → 直接进工作台
  if (to.path === "/login" && authState.isLoggedIn) {
    return { path: "/workbench" };
  }
  if (!isPublic && !authState.isLoggedIn) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }
  return true;
});

// ─── 导航完成后：把当前受保护路由补入「已访问列表」（去重）───
router.afterEach((to) => {
  if (to.meta.public) return;
  const layout = useLayoutStore();
  layout.addVisited({
    path: to.path,
    name: String(to.name ?? to.path),
    title: (to.meta.title as string) ?? to.path,
    component: (to.meta.componentName as string) ?? String(to.name),
    pinned: to.path === "/workbench",
  });
});

export default router;
