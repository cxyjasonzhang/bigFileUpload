// 布局与「已访问路由（历史 Tab）」状态管理
// 仅承载外壳视图状态，不承载任何业务状态
import { defineStore } from "pinia";
import { ref } from "vue";

export interface VisitedRoute {
  /** 路由路径，唯一标识 */
  path: string;
  /** 路由 name，同时作为 keep-alive 的组件缓存 key */
  name: string;
  /** Tab 显示标题 */
  title: string;
  /** 组件 name，供 keep-alive :include 使用 */
  component: string;
  /** 是否固定（工作台固定，不可关闭） */
  pinned: boolean;
}

const WORKBENCH: VisitedRoute = {
  path: "/workbench",
  name: "Workbench",
  title: "工作台",
  component: "Workbench",
  pinned: true,
};

export const useLayoutStore = defineStore(
  "layout",
  () => {
    // 侧栏是否收起
    const collapsed = ref(false);
    // 已访问路由列表（历史 Tab）
    const visitedRoutes = ref<VisitedRoute[]>([{ ...WORKBENCH }]);

    /** 补入一条已访问路由，已存在则跳过 */
    function addVisited(route: VisitedRoute) {
      if (visitedRoutes.value.some((v) => v.path === route.path)) return;
      visitedRoutes.value.push(route);
    }

    /** 从已访问列表移除某路由（pinned 不可移除） */
    function removeVisited(path: string) {
      const idx = visitedRoutes.value.findIndex((v) => v.path === path);
      if (idx === -1) return;
      if (visitedRoutes.value[idx].pinned) return;
      visitedRoutes.value.splice(idx, 1);
    }

    function toggleSidebar() {
      collapsed.value = !collapsed.value;
    }

    function setSidebar(v: boolean) {
      collapsed.value = v;
    }

    // 决策 10：窄屏（<768px）自动收起侧栏；宽屏不强制展开，保留用户显式选择
    function initLayout() {
      const mql = window.matchMedia("(max-width: 768px)");
      const apply = () => {
        if (mql.matches) collapsed.value = true;
      };
      apply();
      mql.addEventListener("change", apply);
    }

    return {
      collapsed,
      visitedRoutes,
      addVisited,
      removeVisited,
      toggleSidebar,
      setSidebar,
      initLayout,
    };
  },
  {
    persist: {
      key: "layout-store",
      // 仅持久化外壳视图状态，不持久化业务数据
      paths: ["collapsed", "visitedRoutes"],
    },
  },
);
