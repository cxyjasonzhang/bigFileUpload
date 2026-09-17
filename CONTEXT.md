# CONTEXT.md

## 项目概述

大文件上传系统（bigFileUpload）— 前后端分离的文件上传与图标管理后台。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite |
| UI 框架 | Element Plus（按需导入，见 ADR-0001） |
| 路由 | Vue Router 4 |
| 状态管理 | Pinia + pinia-plugin-persistedstate |
| 样式 | SCSS + CSS 变量（自定义主题系统） |
| 后端 | Node.js + Express + MySQL |
| 包管理 | npm |

## 目录结构

```
/
├── client/                # 前端项目
│   └── src/
│       ├── components/    # 布局组件（AppHeader, AppSidebar, AppTabs, ConfigDrawer）
│       ├── composables/   # 组合式函数（menuConfig, useTheme）
│       ├── pages/         # 页面（login, workbench, fileUpload, userManagement, iconManager, workflow）
│       ├── router/        # 路由表（嵌套路由 + 鉴权守卫）
│       ├── stores/        # Pinia stores（layout: 侧栏/主题/Tab）
│       ├── styles/        # 全局样式（theme.css: CSS 变量）
│       └── utils/         # 工具函数（auth, api, color, iconCache, uploadQueue）
├── server/                # 后端项目
└── docs/
    ├── adr/               # 架构决策记录
    ├── agents/            # Agent skills 配置
    └── standards/         # 开发规范（弹窗开发规范等）
```

## 关键概念

| 术语 | 含义 |
|---|---|
| **历史 Tab** | 顶部多标签页，记录用户已打开的页面路由（`visitedRoutes`），由 layout store 管理并持久化 |
| **主题模式** | `light` / `dark`，通过 `<html class="dark">` + CSS 变量切换 |
| **主题色** | 7 种可选色，运行时注入 `--el-color-primary-*` CSS 变量 |
| **keep-alive 缓存** | 内容区以 `visitedRoutes` 为 `:include` 的组件名列表，关闭 Tab 即驱逐缓存 |
| **鉴权守卫** | `router.beforeEach` 校验 `authState.isLoggedIn`，未登录重定向 `/login?redirect=...` |
| **固定 Tab** | `VisitedRoute.pinned = true` 的 Tab 不可通过关闭按钮或批量关闭操作移除（工作台默认固定） |
| **Tab 右键菜单** | 使用 `JetMenuRight` 组件，支持刷新/固定/关闭左侧/关闭右侧/关闭其他/关闭全部（见 ADR-0002） |
| **Tab 刷新** | 通过 `v-if` 控制 `<router-view>` 的销毁与重建，触发组件重新挂载（store.refreshKey 驱动） |
| **菜单树** | 菜单管理以树形表格展示（`row-key="menuId"`），`parent_id=0` 为顶级；后端返回平铺列表，前端 `buildMenuTree()` 递归组装，全量加载不分页 |
| **软删除** | 菜单删除执行 `UPDATE sys_menu SET is_deleted = 1`，所有查询过滤 `is_deleted = 0`；角色管理仍为物理删除（见 ADR-0005） |
| **类型联动表单** | 菜单弹窗按 `menu_type`（0目录/1菜单/2按钮）动态显示字段：按钮无 path/icon、必填 perms，目录隐藏 perms |
| **同级交换排序** | 菜单上移/下移仅与同级兄弟节点交换 `order_num`，不跨层级移动，树结构不被破坏 |
| **RBAC** | 基于角色的访问控制：用户通过「用户-角色-菜单」链路获得权限；权限来源为用户拥有角色的并集 |
| **动态菜单** | 侧边栏菜单由后端按当前用户角色动态下发（而非前端静态 `menuConfig`），菜单数据驱动路由渲染 |
| **权限点** | 按钮节点的 `perms` 标识（如 `role:add`），用于按钮级显隐控制与未来的后端接口校验 |
| **超级管理员旁路** | `R_SUPER` 角色跳过权限过滤，直接获得全量菜单与权限 |
| **动态路由注册** | 登录后用 `router.addRoute()` 将后端下发的菜单树动态注入布局路由，无权限路由不注册 |
| **全屏菜单** | 菜单项的全屏展示标记（`is_full_screen`，仅菜单类型有效）：打开该菜单路由时隐藏侧边栏/顶栏/Tab 等布局元素，整页独立展示，区别于 iframe 嵌入 |
| **个人中心** | 当前登录用户编辑自己资料的页面（昵称/姓名/性别/邮箱/手机/联系地址/个人介绍），入口为顶栏「个人信息」；资料字段直接扩展在 `user` 表（不新建 profile 表），保存走 `/auth/profile` 从 token 取当前用户 |

## 主题系统

主题变量分两层：
- **Element Plus 层**：`--el-color-primary` 及其变体（由 `setPrimaryColor()` 运行时注入）
- **自定义层**：`--app-*` 语义变量（bg, header-bg, sidebar-bg, border, text 等），定义在 `styles/theme.css`

`useTheme()` composable 监听 layout store 的 `mode` / `primaryColor`，自动应用。
