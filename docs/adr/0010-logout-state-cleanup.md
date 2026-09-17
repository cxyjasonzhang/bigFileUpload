# ADR-0010：退出登录的前端状态清理

- 日期：2026-09-17
- 状态：已接受
- 关联：ADR-0006（RBAC 动态菜单）、CONTEXT.md「退出登录清理」

## 背景

出现越权 bug：超级管理员登录并访问独有页面后退出，再登录普通角色用户，顶部 Tab 栏仍残留超管访问过的页面，且点击残留 Tab 能进入普通用户无权访问的页面。

根因是「退出登录时状态清理不完整」：`logout()` 只清了 `permission` store（菜单树），漏清了 `layout` store 的 `visitedRoutes`（历史 Tab）和动态注册的路由。

## 决策

### 1. 退出登录必须清理三类前端状态

`logout()` 依次清理：

1. **登录态**：`accessToken`、`authState.user`、`authState.isLoggedIn`。
2. **权限态**：`permission` store 的菜单树 / 权限点 / 角色（`reset()`）。
3. **会话残留态**：
   - `layout` store 的 `visitedRoutes`（历史 Tab，`resetVisited()` 重置为仅固定工作台）。
   - 动态注册的路由（`clearDynamicRoutes()` 全量移除）。

### 2. 动态路由注册改为「先清空再重建」

- `dynamic.ts` 用模块级 `registeredRouteNames` 记录每次注册的动态路由名。
- `registerDynamicRoutes()` 先 `clearDynamicRoutes()` 清空上一次注册的路由，再注入当前用户菜单对应的路由。
- 理由：此前只 `removeRoute`「当前菜单里有的路由」，上一用户独有的路由（不在当前菜单中）会残留，导致越权。

### 3. 清理集中在 `logout()` 一个入口

- 把所有清理逻辑放进 `logout()`，避免「清了这个 store 漏了那个」。
- 理由：登录/退出是会话生命周期的边界，状态清理应内聚在边界处，而非散落多处。

## 后果

- `logout()` 新增对动态路由与历史 Tab 的清理。
- `layout` store 新增 `resetVisited()`；`dynamic.ts` 新增 `clearDynamicRoutes()` 与 `registeredRouteNames`。
- 切换用户后不再残留上一个用户的 Tab 与路由，越权访问路径被封堵。
- 若未来新增「会随登录态变化的前端状态」，应同步纳入 `logout()` 的清理清单。
