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
    └── agents/            # Agent skills 配置
```

## 关键概念

| 术语 | 含义 |
|---|---|
| **历史 Tab** | 顶部多标签页，记录用户已打开的页面路由（`visitedRoutes`），由 layout store 管理并持久化 |
| **主题模式** | `light` / `dark`，通过 `<html class="dark">` + CSS 变量切换 |
| **主题色** | 7 种可选色，运行时注入 `--el-color-primary-*` CSS 变量 |
| **keep-alive 缓存** | 内容区以 `visitedRoutes` 为 `:include` 的组件名列表，关闭 Tab 即驱逐缓存 |
| **鉴权守卫** | `router.beforeEach` 校验 `authState.isLoggedIn`，未登录重定向 `/login?redirect=...` |

## 主题系统

主题变量分两层：
- **Element Plus 层**：`--el-color-primary` 及其变体（由 `setPrimaryColor()` 运行时注入）
- **自定义层**：`--app-*` 语义变量（bg, header-bg, sidebar-bg, border, text 等），定义在 `styles/theme.css`

`useTheme()` composable 监听 layout store 的 `mode` / `primaryColor`，自动应用。
