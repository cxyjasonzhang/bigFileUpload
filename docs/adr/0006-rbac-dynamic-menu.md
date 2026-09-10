# ADR-0006：RBAC 动态菜单设计

- 日期：2026-08-19
- 状态：已接受
- 关联：ADR-0005（菜单管理）、CONTEXT.md「RBAC / 动态菜单」

## 背景

系统已有菜单管理（`sys_menu`）、角色管理（`role`）、用户管理（`user`）三个独立模块，但三者互不关联：
登录是写死的 `DEMO_USER`，侧边栏与路由均为前端静态配置。本次需将「用户 - 角色 - 菜单」链路打通，实现**基于 RBAC 的动态菜单渲染**（侧边栏与路由均由后端按当前用户角色下发）。

## 决策

### 1. 关系模型：多对多 RBAC

- 新增两张关联表：
  - `sys_user_role`（用户 ↔ 角色，多对多）
  - `sys_role_menu`（角色 ↔ 菜单，多对多）
- 权限来源为用户所拥有**角色的并集**。
- 理由：多对多是 RBAC 事实标准，一步到位避免后续返工；`api.d.ts` 中预留的 `roles: string[]`（复数）亦暗示多角色语义。

### 2. 用户表扩展（而非新建登录表）

- 复用现有 `user` 表，新增 `account`（登录账号）、`password`（密码哈希）、`status`（启用状态）字段。
- 密码使用 bcrypt 哈希存储，绝不存明文。
- 现有 10 条用户数据补账号（= 手机号）与默认密码。
- 理由：demo 规模下直接扩展最直观；另建 `sys_account` 表是过度设计。

### 3. 菜单表新增 `component` 列

- `sys_menu` 新增 `component` 字段，存储组件相对路径（如 `roleManage/index`），与 `path`（路由地址）语义分离。
- 前端用 `import.meta.glob` 按 `component` 动态导入真实组件。
- 理由：真正的「数据驱动」动态路由必须由数据声明渲染组件，否则每新增页面仍需改前端代码（半动态）。

### 4. 授权粒度：按钮级全量授权

- `sys_role_menu` 可关联目录（0）/ 菜单（1）/ 按钮（2）三类节点。
- 角色既控制「可见页面」，也控制「页面内按钮显隐」。
- 按钮的 `perms` 标识（如 `role:add`）作为按钮级权限点。
- 理由：`sys_menu.menu_type=2` 与 `perms` 字段、`api.d.ts` 的 `buttons` 字段均为此设计；完整 RBAC 的核心价值。

### 5. 超级管理员旁路

- 识别到 `R_SUPER` 角色时，直接返回全量菜单、跳过权限校验（前端亦全量渲染）。
- 不做「给 super 预置全部授权记录」。
- 理由：super 的语义是「永不被拦」，旁路最简洁且不产生随菜单变动的脏数据。

### 6. 前端路由动态化：`addRoute`

- 登录后调用 `GET /auth/routes` 获取菜单树，`import.meta.glob` 映射组件，`router.addRoute()` 注入布局路由。
- 侧边栏改为读后端下发的菜单树（存 store），废弃静态 `menuConfig.ts`。
- 无权限路由不注册，URL 直访落到 404，形成安全闭环。

### 7. 后端权限点校验：本次不做（预留）

- 本次 RBAC 仅实现「菜单/路由/按钮的**前端动态渲染**」，后端接口保持现状（登录即可调）。
- `perms` 数据已具备，未来可低成本补充 `checkPerms` 中间件。

## 后果

- 新增 `sys_user_role`、`sys_role_menu` 表；`user` 表与 `sys_menu` 表结构变更（需执行改造 SQL）。
- 登录逻辑从写死 `DEMO_USER` 改为查库校验 bcrypt 密码；`admin/admin123` 需落库并挂 `R_SUPER`。
- 前端新增 `GET /auth/routes`、`GET /auth/permissions` 两个接口，`menuConfig.ts` 被替换为后端驱动。
- 前端引入 `v-perms` 指令 + `hasPerms()` 函数控制按钮显隐。
- 角色管理页新增「分配权限」入口，`el-tree` 展示含按钮的三层菜单树供勾选。
