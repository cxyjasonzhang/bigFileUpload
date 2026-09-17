# ADR-0008：个人中心设计

- 日期：2026-09-16
- 状态：已接受
- 关联：ADR-0006（RBAC 动态菜单）、CONTEXT.md「个人中心」

## 背景

系统需要「个人中心」页面，供当前登录用户查看并编辑自己的资料（昵称、姓名、性别、邮箱、手机、联系地址、个人介绍）。用户表（`user`）已存在，需决定资料如何存储、以及保存接口的权限语义。

## 决策

### 1. 资料字段直接扩展 `user` 表（不新建 profile 表）

- 新增 `nickname`（昵称）、`gender`（性别）、`email`（邮箱）、`bio`（个人介绍）四个字段。
- 姓名复用 `username`、手机复用 `phone`、联系地址复用 `home_address`。
- 理由：这些字段是「用户」实体的固有属性，非独立聚合；`user` 表本身已混有身份字段（account/password）与资料字段（phone/home_address），继续扩展一致且免 join；与 ADR-0006「复用 user 表而非新建登录表」一脉相承。

### 2. 保存接口独立为 `/auth/profile`，从 token 取当前用户

- 新增 `GET /auth/profile`（读资料）与 `PUT /auth/profile`（写资料），均从 token 的 `sub` 取当前用户 id，不接收前端传 id。
- 不扩展现有 `/auth/me`（登录态身份），避免影响 `authState` 与顶栏展示。
- 理由：个人中心是「改自己」，复用 `PUT /users/:id`（管理员改任意用户）会引入越权风险；从 token 取 id 天然防越权。

### 3. 只改资料字段，不碰登录凭证

- `PUT /auth/profile` 仅更新 username/nickname/gender/email/phone/home_address/bio，绝不更新 account/password。
- 理由：登录凭证的变更（改密、换绑账号）属于独立的安全敏感流程，不应混入资料编辑。

### 4. 入口与路由

- 个人中心通过顶栏下拉「个人信息」进入（`/profile`），不占侧边栏菜单。
- `/profile` 注册为静态路由（与 `/workbench` 并列），因为它是「每个用户都有、无需权限控制」的页面，与工作台同性质，不适合走菜单动态下发。

### 5. 昵称暂不接管全局显示名

- 引入 `nickname` 后，顶栏/工作台仍显示姓名（`username`），昵称仅作为资料字段存储。
- 理由：改全局显示涉及顶栏、工作台、欢迎语等多处，是独立变更；等个人中心跑通后再单独评估「昵称接管显示」。

## 后果

- `user` 表新增 4 个字段（需执行 `user_profile_init.sql`）。
- 新增 `GET/PUT /auth/profile` 接口，前端新增 `fetchUserProfile/updateUserProfile` 封装。
- 顶栏「个人信息」从占位提示改为跳转 `/profile`。
- 新增 `pages/profile/index.vue` 页面，静态注册 `/profile` 路由。
