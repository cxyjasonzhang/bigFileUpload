// 动态路由注册：把后端下发的菜单树转换为 vue-router 路由并 addRoute 注入

import { defineComponent, h } from "vue";
import type { RouteRecordRaw } from "vue-router";
import type { MenuItem } from "@/types/router";
import router from "./index";

// 预扫描所有页面组件
// 使用以 / 开头的绝对模式（相对项目根），Vite 会稳定扫描到文件
// key 形如 "/src/pages/workbench/index.vue"
const modules = import.meta.glob("/src/pages/**/*.vue");

// 最终兜底占位组件：组件解析失败时保证路由能注册、页面能渲染（显示缺失提示）
const FallbackComponent = defineComponent({
  name: "ComponentMissing",
  setup() {
    return () => h("div", { style: "padding: 40px; text-align: center; color: #999;" }, "页面组件未找到");
  },
});

/**
 * 根据菜单的 component 字段解析真实组件
 * @param component 组件相对路径（如 "roleManage/index"）
 */
function resolveComponent(component?: string) {
  // 规范化：去掉首尾斜杠与 .vue 后缀，得到形如 "roleManage/index"
  const normalized = component
    ?.replace(/^\/+|\/+$/g, "")
    .replace(/\.vue$/, "");

  if (!normalized) return FallbackComponent;

  // 精确匹配绝对 key：/src/pages/<normalized>.vue
  const exactKey = `/src/pages/${normalized}.vue`;
  if (modules[exactKey]) return modules[exactKey];

  // 兜底 1：遍历 key，用「pages/<normalized>.vue」后缀匹配（兼容 Windows 反斜杠等差异）
  const targetSuffix = `pages/${normalized}.vue`;
  for (const key of Object.keys(modules)) {
    const cleanKey = key.replace(/\\/g, "/");
    if (cleanKey.endsWith(targetSuffix)) {
      return modules[key];
    }
  }

  // 兜底 2：返回 404 组件
  for (const key of Object.keys(modules)) {
    const cleanKey = key.replace(/\\/g, "/");
    if (cleanKey.endsWith("pages/exception/404/index.vue")) {
      return modules[key];
    }
  }

  // 最终兜底：占位组件，避免路由缺 component 报错
  return FallbackComponent;
}

/**
 * 将菜单树转换为路由记录（只处理菜单类型为 1 的节点，目录仅用于侧边栏折叠）
 */
function menuToRoutes(menus: MenuItem[]): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = [];

  const walk = (nodes: MenuItem[]) => {
    nodes.forEach((node) => {
      // 目录（menuType=0）不生成路由，仅递归子级
      if (node.menuType === 1) {
        const component = resolveComponent(node.component);
        // name 必须全局唯一：component 路径如 "roleManage/index" 去掉斜杠与 .vue 后缀，
        // 得到 "roleManage-index"；缺省时用 menuId 兜底
        const routeName =
          node.component?.replace(/[\/.]/g, "-") || `menu-${node.menuId}`;
        routes.push({
          path: node.path.replace(/^\//, ""),
          name: routeName,
          component,
          meta: {
            title: node.menuName,
            componentName: routeName,
          },
        });
      }
      if (node.children?.length) walk(node.children);
    });
  };

  walk(menus);
  return routes;
}

/**
 * 注册动态路由：清空布局壳子路由后重新注入
 * @param menuTree 当前用户的菜单树
 */
export function registerDynamicRoutes(menuTree: MenuItem[]) {
  const layoutRoute = router.getRoutes().find((r) => r.name === "Layout");
  if (!layoutRoute) return;

  // 移除旧的动态子路由
  const childRoutes = menuToRoutes(menuTree);
  // addRoute 到布局壳（name 为 "Layout" 的父路由）
  childRoutes.forEach((child) => {
    // 同名路由先移除再添加，避免重复
    if (router.hasRoute(child.name as string)) {
      router.removeRoute(child.name as string);
    }
    router.addRoute("Layout", child);
  });
}

export { menuToRoutes, resolveComponent };
