# ADR-0011：会话生命周期收敛

- 日期：2026-09-30
- 状态：已接受
- 关联：ADR-0010（退出登录的前端状态清理）、ADR-0006（RBAC 动态菜单）、CONTEXT.md「鉴权守卫 / 动态菜单」

## 背景

`utils/auth.ts` 逐渐演变为「上帝函数」：token 管理、登录态、登录 / 登出 / 刷新 / 会话恢复、动态菜单加载、登出跨模块编排、拦截器装配，共 8 类职责塞在一个 util 里。同时出现多处架构摩擦：

1. **双套刷新锁**：`auth.ts` 的 `refreshAccessToken` 内部一套 `isRefreshing + refreshSubscribers`，`api.ts` 拦截器又一套，订阅回调签名还不一致。
2. **双套登录态**：`authState`（被真实使用）与 `stores/user.ts` 的 `isLogin / info / accessToken`（空 store + 死代码，从未被消费）并存。
3. **职责错位**：动态菜单加载（`loadDynamicAccess`）属于 RBAC / 路由职责，却混入 auth util。
4. **清理不完整**：`permission.reset()` 漏清 `homePath`，登出后跨用户残留。

## 决策

### 1. 刷新并发锁唯一归属拦截器层

- `api.ts` 响应拦截器是唯一持有 `isRefreshing + refreshSubscribers` 的地方，负责「多请求并发 401 的排队与重放」。
- `auth.ts` 的 `refreshAccessToken` 降为纯请求函数（发 `POST /auth/refresh` 并 `setAccessToken`），不再自建锁。
- 理由：拦截器锁已覆盖并发场景；`initAuth` 挂载前单发调用无需锁；去掉内层锁消除两套锁语义漂移。

### 2. 登录态唯一真相源 = authState

- 删除 `stores/user.ts`（空 store + 死代码），登录态只由 `auth.ts` 的 `authState` 承载。
- 理由：避免未来有人误接第二套 `isLogin` 造成鉴权判定不一致。

### 3. 动态菜单 / 权限加载收敛为 permission.load()

- `loadDynamicAccess` 移入 `stores/permission.ts` 成为 `load()` action：拉权限 → 拉菜单 → 组装树 → `registerDynamicRoutes()`。
- `auth.ts` 的 `login / initAuth` 只需 `await usePermissionStore().load()`。
- 理由：菜单 / 权限数据的拥有者（permission）自行负责加载，session 变薄，未来「切换角色后刷新权限」可复用。

### 4. logout 清理清单补 homePath

- `permission.reset()` 补 `homePath.value = HOME_PAGE_PATH`。
- 清理顺序维持 ADR-0010：清 token / authState → `permission.reset()` → `clearDynamicRoutes()` → `layout.resetVisited()`。

## 后果

- 删除 `stores/user.ts` 与 `permission.isRoutesLoaded`（后者为死状态，无任何读取点）。
- `auth.ts` 的窄接口收敛为：`authState / getAccessToken / login / logout / initAuth / setupAuth`。
- `api.ts` 拦截器的排队订阅者从 `(token) => void` 改为 `{ resolve, reject }`，修复「刷新失败时排队请求永久挂起」的隐患。
- 新增 `permission.load()`，删除 `loadDynamicAccess`。
