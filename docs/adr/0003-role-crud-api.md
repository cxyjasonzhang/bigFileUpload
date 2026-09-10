# ADR-0003: 角色管理 CRUD 接口

## 状态

已采纳（2026-08-07）

## 背景

已创建角色表（`server/sql/role_init.sql`），前端角色管理页（`pages/roleManage/index.vue`）当前使用 mock 数据，需要对接真实接口。

## 决策

### 接口设计

| 方法 | 路径 | 参数 | 响应 |
|---|---|---|---|
| GET | `/roles` | query: `roleName`, `roleCode`, `page`(默认1), `pageSize`(默认10) | `{ code: 0, data: { list, total, page, pageSize, totalPages } }` |
| POST | `/roles` | body: `{ roleName, roleCode, description, enabled }` | `{ code: 0, msg: "新建角色成功" }` |
| PUT | `/roles/:id` | body: `{ roleName, roleCode, description, enabled }` | `{ code: 0, msg: "编辑角色成功" }` |
| DELETE | `/roles/:id` | 无 | `{ code: 0, msg: "删除角色成功" }` |

### 架构

- 路由文件：`server/routes/roles.js`，挂载到 `server/index.js`（`app.use("/roles", ...)`）
- 数据库操作：`server/db/roleApi.js`，直接写 SQL（与 `db/api.js` 风格一致）
- 鉴权：所有角色接口均需 `authMiddleware`（与 `/users` 一致）
- 前端 API：`client/src/api/system-manage.ts`，导出 `fetchGetRoleList`、`fetchCreateRole`、`fetchUpdateRole`、`fetchDeleteRole`

### 涉及文件

| 文件 | 改动 |
|---|---|
| `server/db/roleApi.js` | 新：角色 CRUD 数据库操作 |
| `server/routes/roles.js` | 新：角色接口路由 |
| `server/index.js` | 新增 `app.use("/roles", ...)` |
| `client/src/api/system-manage.ts` | 新：角色 API 请求函数 |
| `client/src/pages/roleManage/index.vue` | `apiFn` 从 mock 改为真实接口 |

## 后果

- **正面**：角色管理页对接真实数据，支持分页搜索和 CRUD
- **正面**：接口风格与现有 `/users` 完全一致，维护成本低
- **风险**：`roleCode` 唯一性由数据库 `uk_role_code` 保证，重复插入返回 500 错误，需前端处理
