# ADR-0002: 历史 Tab 右键操作菜单

## 状态

已采纳（2026-08-06）

## 背景

当前历史 Tab 栏（AppTabs）仅支持点击切换和关闭两个操作。需要增加右键菜单，提供更丰富的 Tab 管理能力。

## 决策

### 右键菜单组件

使用已有的 `JetMenuRight` 组件（`src/components/others/jet-menu-right/index.vue`）。该组件通过 `defineExpose` 暴露 `show(e: MouseEvent)` 方法，接收原生右键事件并自动计算菜单位置（含边界检测）。每个 Tab 绑定 `@contextmenu.prevent="handleContextMenu($event, tag)"` 调用 `menuRef.show(e)`。

### 菜单项

| 操作 | key | 禁用条件 |
|---|---|---|
| 刷新 | `refresh` | 仅右键 Tab 是当前激活页时可用 |
| 固定/取消固定 | `pin` | 工作台不可取消固定；动态文案 |
| 关闭左侧 | `close-left` | 左侧无可关闭 Tab 时禁用 |
| 关闭右侧 | `close-right` | 右侧无可关闭 Tab 时禁用 |
| 关闭其他 | `close-others` | 除当前 + 工作台外无 Tab 时禁用 |
| 关闭全部 | `close-all` | 除工作台外无 Tab 时禁用 |

分割线位于"关闭右侧"和"关闭其他"之间，将刷新+固定与关闭类操作分为两组。

### 固定 Tab

store 新增 `pinVisited(path)` 和 `unpinVisited(path)` 方法。`pinned` 字段已存在于 `VisitedRoute` 接口中，且 `visitedRoutes` 已在 persist 的 `paths` 中，固定状态自动持久化。

### 刷新机制

store 新增 `refreshKey: number` 计数器。AppTabs 右键"刷新"时 `refreshKey++`。AppLayout watch `refreshKey`，通过 `v-if="isRefresh"` 控制 `<router-view>` 的销毁与重建：

```ts
const isRefresh = ref(true)
watch(() => layout.refreshKey, () => {
  isRefresh.value = false
  nextTick(() => { isRefresh.value = true })
})
```

### 涉及文件

| 文件 | 改动 |
|---|---|
| `src/stores/layout.ts` | 新增 `refreshKey`、`pinVisited()`、`unpinVisited()` |
| `src/components/layout/AppTabs.vue` | 集成 JetMenuRight，添加右键事件和菜单逻辑 |
| `src/components/layout/AppLayout.vue` | watch `refreshKey`，v-if 控制 router-view |

## 后果

- **正面**：Tab 管理能力大幅提升，用户可自由固定/批量关闭
- **正面**：刷新操作无需整页重载，仅重建当前页面组件
- **风险**：`v-if` 重建 `<router-view>` 时会短暂卸载 keep-alive 内所有组件再重新挂载，若页面多可能有轻微闪烁
