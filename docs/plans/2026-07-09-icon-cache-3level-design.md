# 图标三级缓存设计（icon-cache-3level）

> 日期：2026-07-09
> 目标：消除 `<SvgIcon>` 每次渲染都走网络的问题，引入「内存 → IndexedDB → 网络」三级缓存。

## 1. 背景与现状

- `client/src/components/SvgIcon.vue` 内部已有一个模块级 `Map` 作为 L1 内存缓存（第 27-28 行），但有两个缺陷：
  1. **刷新即失**：页面刷新 / 跨会话后 `Map` 清空，所有图标重新请求网络。
  2. **并发重复请求**：同一 `name` 的多个 `<SvgIcon>` 同时挂载时，`await resolveIcon` 是异步的，会并发打 N 次相同请求。
- 后端 `GET /icons/resolve?name=` 返回 `{ code:0, data:{ svgContent } }`，只有内容、无版本号 / ETag。
- `resolveIcon` 仅被 `SvgIcon.vue` 使用 → **改造面极小**，只需替换其内部缓存逻辑。
- `icons` 表有 `updated_at`（ON UPDATE CURRENT_TIMESTAMP），但**删除不更新它** → 版本号不能靠 `MAX(updated_at)`，必须用整数计数器。

## 2. 总体架构

```
┌─ 新模块 utils/iconCache.js ───────────────┐
│ get(name)          读：L1→L2→L3 + 并发合并 │
│ invalidate(name)   A：删单条（memory+idb）  │
│ invalidateAll()    A：清全库                  │
│ checkVersion()     B：启动比对，不符则清全库  │
│ refreshVersion()   A 改后调用，写新版本到meta │
└───────────────────────────────────────────────┘
        ▲ SvgIcon.vue 改用 get()
        ▲ iconManager 各 CRUD 成功后调 invalidate/refreshVersion
        ▲ App.vue onMounted 调 checkVersion

L1 memory : Map<name, svgContent> + Map<name, Promise> (pending)
L2 idb     : DB "icon-cache"
              ├ store "icons"  { name, svgContent, savedAt }
              └ store "meta"    { key:'iconVersion', value:int }
L3 network : 现有 api.resolveIcon(name)
```

**改动面**：
- `SvgIcon.vue`：内部 `Map` 替换为 `iconCache.get()`。
- 新增 `utils/iconCache.js` 独立模块。
- 后端：新增 `app_meta` 表 + `GET /icons/version`，并在各变更函数内 bump 版本号。
- 其他消费 `SvgIcon` 的文件无需改动。

## 3. 读取流程 + 并发合并 + 失败兜底

**`get(name)` 主流程**

```
get(name):
  if memory.has(name)        → 返回（L1 命中）
  if pending.has(name)       → 返回该 Promise（并发合并）
  p = (async () => {
     const rec = await idbGet(name)         // L2
     if (rec) { memory.set(name, rec.svgContent); return rec.svgContent }
     const res = await api.resolveIcon(name) // L3
     const svg = res.data?.data?.svgContent || ''
     memory.set(name, svg); await idbSet(name, svg)
     return svg
  })()
  pending.set(name, p)
  try { return await p } finally { pending.delete(name) }
```

**并发合并**：同一 `name` 的多个 `<SvgIcon>` 同时挂载，第一个发起 L3 并把 Promise 存入 `pending`；其余直接复用，**只发 1 次网络**。

**失败兜底（严格按版本，结论 B）**：
- `resolveIcon` 抛错（401/断网/404）→ `get` 抛出，调用方 `SvgIcon` 静默隐藏（沿用现状）。
- **版本失效优先于显示**：`checkVersion()` 判定版本不符 → `invalidateAll()` 清掉 L1+L2 → 此后 `get` 必走 L3，L3 成功才显示，失败则隐藏。不会出现"版本已变却还显示旧图标"。
- `idbSet` 写入失败（如隐私模式 IDB 不可用）需 `try/catch` 吞掉，不影响主流程渲染。

## 4. A+B 失效策略

**A. 主动失效（同标签页即时）**
```
图标管理页（iconManager/index.vue）各 CRUD 成功后：
  createIcon / updateIcon / deleteIcon       → iconCache.invalidate(name) + refreshVersion()
  batchCreateIcons / batchDeleteIcons        → iconCache.invalidateAll() + refreshVersion()
     * name = `${groupSlug}/${icon.name}`（后端列表已带回 groupSlug）
```

**B. 全局版本号（跨会话 / 跨标签页）**
- 后端维护整数计数器 `app_meta.icon_version`，任何图标变更（含删除）都 +1。
- `App.vue onMounted` 调 `iconCache.checkVersion()`（**仅启动一次**，结论 A）：
  - `server = GET /icons/version`；`local = meta.iconVersion`
  - 不一致 → `invalidateAll()` 并写入新版本。
- `refreshVersion()`：CRUD 成功后再次 `GET /icons/version` 并写入 `meta`，使本地版本与服务端一致，避免下次启动 B 误判全清。两机制互不打架。

> 跨标签页「不刷新即感知」属可选增强（BroadcastChannel），本期不做。

## 5. 后端改动清单（B 必需）

| 改动 | 内容 |
|------|------|
| 新增表 `app_meta(key VARCHAR PK, value INT)` | 种子 `icon_version = 0`（迁移 SQL） |
| `iconApi` 各变更函数内 | `UPDATE app_meta SET value=value+1 WHERE key='icon_version'`（create/update/delete/批量都 +1，含删除） |
| 新增路由 `GET /icons/version` | 返回 `{ code:0, data:{ version } }`，挂 `authMiddleware` 与 resolve 一致 |
| `api.js` 新增 `getIconVersion()` | 供前端调用 |

## 6. IndexedDB 选型

采用 **`idb` 库**（~1KB、Promise 化），异步缓存流程最自然。零依赖备选：手写 ~40 行原生包装（open/get/set/delete/clear）。本期按推荐用 `idb`。

## 7. 范围与边界

- **缓存范围**：仅按需 `resolve` 的单个图标；图标管理页列表（`getIcons` 已带回 svgContent）不缓存。
- **不做启动预热全量**（结论）：图标量级千级以内，IDB 无限增长可接受（结论 A 不淘汰）。
- **验证方式（结论 A 手动）**：开发时打开 Network 面板确认 ① 同 `name` 多个 `<SvgIcon>` 只发 1 次 `/icons/resolve`；② 刷新页面后不再发 resolve 请求（IDB 命中）。
