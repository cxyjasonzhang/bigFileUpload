# 增删改查（CRUD）页面开发规范

> 适用范围：`client/` 前端表格页 + `server/` 后端接口，涵盖查询列表、新增、编辑、删除、查看等后台管理系统常见页面。
> 建立背景：以角色管理页（`client/src/pages/roleManage/` + `server/routes/roles.js` + `server/db/roleApi.js`）为标杆沉淀的标准化开发方式。

## 1. 整体架构

一个完整的 CRUD 功能由以下部分组成，**各司其职、分层清晰**：

| 层 | 文件 | 职责 |
|---|---|---|
| 前端页面 | `client/src/pages/<模块>/index.vue` | 搜索栏 + 表格 + 操作按钮 + 弹窗编排 |
| 前端弹窗 | `client/src/pages/<模块>/modules/*-dialog.vue` | 新增/编辑/查看弹窗（详见弹窗规范） |
| 前端接口 | `client/src/utils/api.ts` | 类型定义 + 请求封装 |
| 后端路由 | `server/routes/<模块>.js` | RESTful 路由 + 参数校验 + 统一响应 |
| 后端数据层 | `server/db/<模块>Api.js` | SQL 查询，全部参数化 |

## 2. 前端页面结构（模板）

页面模板固定三段式：**搜索区域 → 表格卡片 → 弹窗**。

```vue
<template>
  <div class="user-page art-full-height">
    <!-- ① 搜索区域 -->
    <JetSearchBar
      ref="searchBarRef"
      v-model="searchFormState"
      :items="searchItems"
      :rules="rules"
      :is-expand="false"
      :show-expand="true"
      :show-reset-button="true"
      :show-search-button="true"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- ② 表格卡片 -->
    <ElCard class="flex-1 art-table-card">
      <!-- 工具栏：新增 / 批量删除等操作按钮 -->
      <JetTableHeader
        :loading="loading"
        layout="size,fullscreen"
        fullClass="art-table-card"
      >
        <template #left>
          <ElSpace wrap>
            <ElButton type="primary" @click="handleAdd" v-ripple>
              <ElIcon><Plus /></ElIcon> 新增角色
            </ElButton>
            <ElButton @click="handleBatchDelete" :disabled="selectedRows.length === 0" v-ripple>
              <ElIcon><Delete /></ElIcon> 批量删除 ({{ selectedRows.length }})
            </ElButton>
          </ElSpace>
        </template>
      </JetTableHeader>

      <!-- 表格 -->
      <JetTable
        ref="tableRef"
        :loading="loading"
        :pagination="pagination"
        :data="(data as RoleListItem[])"
        :columns="columns"
        @selection-change="handleSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
        <!-- 操作列：查看 / 编辑 / 删除 -->
        <template #operation="{ row }">
          <div class="flex">
            <JetButtonTable type="view" :row="row" @click="handleView(row)" />
            <JetButtonTable type="edit" :row="row" @click="handleEdit(row)" />
            <JetButtonTable type="delete" :row="row" @click="handleDelete(row)" />
          </div>
        </template>
      </JetTable>
    </ElCard>

    <!-- ③ 新增/编辑弹窗（成功后刷新列表） -->
    <RoleEditDialog v-model="dialogVisible" :dialog-type="dialogType" :role-data="currentRole" @success="getData" />

    <!-- ④ 查看弹窗（纯展示） -->
    <RoleViewDialog v-model="viewDialogVisible" :role-data="viewRole" />
  </div>
</template>
```

## 3. 搜索栏配置

**查询条件尽量精简**（建议 3~5 个高频条件），输入类用 `input`，枚举类用 `select`（首项固定为「全部」+ 空值）。

```ts
// 初始值：字段名与后端查询参数一一对应
const searchFormState = ref({
  roleName: '',
  roleCode: '',
  enabled: '' // 下拉用字符串，'' 表示不过滤
})

const searchItems = computed(() => [
  { key: 'roleName', label: '角色名称', type: 'input', props: { placeholder: '请输入角色名称' } },
  { key: 'roleCode', label: '角色编码', type: 'input', props: { placeholder: '请输入角色编码' } },
  {
    key: 'enabled',
    label: '启用状态',
    type: 'select',
    options: [
      { label: '全部', value: '' },
      { label: '启用', value: '1' },
      { label: '禁用', value: '0' }
    ]
  }
])
```

搜索 / 重置统一走 `useTable` 提供的方法：

```ts
const handleSearch = async () => {
  await searchBarRef.value.validate()
  replaceSearchParams(buildSearchParams(searchFormState.value)) // 替换搜索参数（自动回第 1 页）
  getData() // 注意：useTable 返回的 getData 即 getDataByPage（重置第 1 页 + 清当前搜索缓存）
}

const handleReset = () => {
  resetSearchParams() // 清空所有搜索参数并重新加载
}
```

## 4. useTable 核心用法

所有列表页必须使用 `useTable`（`@/hooks/core/useTable`），**禁止手写 loading / 分页 / 数据请求**。

### 4.1 解构常用能力

| 返回值 | 用途 |
|---|---|
| `data` / `loading` | 表格数据 / 加载状态 |
| `pagination` | 分页信息（`current` / `size` / `total`） |
| `searchParams` / `replaceSearchParams` / `resetSearchParams` | 搜索参数管理 |
| `getData` | 加载数据（重置第 1 页） |
| `handleSizeChange` / `handleCurrentChange` | 分页变化处理（直接绑定给 JetTable） |
| `refreshCreate` / `refreshUpdate` / `refreshRemove` | 增/改/删后的智能刷新 |
| `clearData` | 清空数据 |
| `columns` | 列配置 |

### 4.2 配置项

```ts
const { data, loading, pagination, getData, columns, /* ... */ } = useTable({
  core: {
    // ① 请求函数：把页面参数映射为接口参数，并归一化响应结构
    apiFn: (params) =>
      fetchGetRoleList({
        roleName: params.roleName || undefined,
        roleCode: params.roleCode || undefined,
        enabled: params.enabled === '' ? undefined : Number(params.enabled), // 空字符串不过滤
        page: params.current,
        pageSize: params.size
      }).then((res) => ({
        records: res.data.data.list,   // 表格数据
        current: res.data.data.page,   // 当前页
        size: res.data.data.pageSize,  // 每页条数
        total: res.data.data.total     // 总数
      })),
    apiParams: { current: 1, size: 10 }, // 默认分页参数
    immediate: true, // 挂载即加载
    columnsFactory: () => [ /* 列配置，见 4.3 */ ]
  },
  performance: {
    enableCache: true,
    cacheTime: 5 * 60 * 1000,
    debounceTime: 300,
    maxCacheSize: 100
  },
  hooks: {
    onSuccess: (data, response) => { /* 可选：加载成功日志/统计 */ },
    onError: (error) => {
      console.error('数据加载失败:', error)
      ElMessage.error(error.message)
    }
  }
})
```

### 4.3 列配置约定

```ts
columnsFactory: () => [
  { type: 'selection', width: 50 },                    // 多选列（批量删除需要）
  { type: 'globalIndex', width: 60, label: '序号' },   // 全局序号
  { prop: 'roleName', label: '角色名称', minWidth: 160, sortable: true },
  { prop: 'roleCode', label: '角色编码', minWidth: 140, sortable: true },
  {
    prop: 'enabled',
    label: '状态',
    width: 100,
    formatter: (row) => (row.enabled ? '启用' : '禁用') // 0/1 字段展示转换
  },
  {
    prop: 'operation',
    label: '操作',
    width: 190,
    useSlot: true,      // 配合 #operation 插槽
    fixed: 'right'      // 固定右侧
  }
]
```

## 5. 增 / 改 / 删 / 查看处理

### 5.1 新增与编辑（共用弹窗）

```ts
const handleAdd = () => {
  dialogType.value = 'add'
  currentRole.value = undefined // 新增不传行数据
  dialogVisible.value = true
}

const handleEdit = (row: RoleListItem) => {
  dialogType.value = 'edit'
  currentRole.value = row // 编辑回填
  dialogVisible.value = true
}
```

弹窗内部（新增/编辑表单）规范**详见 `docs/standards/dialog-development.md`**，要点：
- Props：`modelValue` + `dialogType: 'add' | 'edit'` + 行数据（编辑时）
- Emits：`update:modelValue` + `success`（保存成功后由父组件 `getData()` 刷新）
- 后端 0/1 字段 ↔ 表单布尔值用 `!!value` / `Number()` 转换

### 5.2 删除（必须二次确认）

```ts
const handleDelete = async (row: RoleListItem) => {
  try {
    await ElMessageBox.confirm(`确定要删除角色「${row.roleName}」吗？`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await fetchDeleteRole(row.roleId)
    ElMessage.success(`删除角色「${row.roleName}」成功`)
    refreshRemove() // 智能刷新：删除后自动调整页码，避免空页面
  } catch (error: any) {
    if (error?.response?.data?.msg) {
      ElMessage.error(error.response.data.msg) // 优先展示后端错误信息
    } else {
      ElMessage.info('已取消删除')
    }
  }
}
```

### 5.3 批量删除

```ts
const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedRows.value.length} 个角色吗？`,
      '警告',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await Promise.all(selectedRows.value.map((row) => fetchDeleteRole(row.roleId)))
    ElMessage.success(`批量删除 ${selectedRows.value.length} 个角色成功`)
    selectedRows.value = []
    refreshRemove()
  } catch (error: any) {
    if (error?.response?.data?.msg) ElMessage.error(error.response.data.msg)
    else ElMessage.info('已取消删除')
  }
}
```

### 5.4 查看（只读弹窗）

- 列表接口已返回的字段**直接复用行数据**，无需额外请求
- 用 `ElDescriptions` 只读展示，0/1 状态字段用 `ElTag` 着色（启用=success / 禁用=info）

```ts
const handleView = (row: RoleListItem) => {
  viewRole.value = row
  viewDialogVisible.value = true
}
```

## 6. 前端接口定义（api.ts）

接口类型与请求封装集中在 `client/src/utils/api.ts`，遵循以下约定：

```ts
/** 角色列表查询参数 */
export interface RoleQuery {
  roleName?: string;
  roleCode?: string;
  /** 启用状态：0 禁用 / 1 启用 */
  enabled?: number;
  page?: number;
  pageSize?: number;
}

/** 获取角色列表（分页 + 搜索） */
export function fetchGetRoleList(params: RoleQuery = {}) {
  return request.get<ApiResponse<RoleListResult>>("/roles", { params });
}
```

- 每个接口配一个 `fetchXxx` 函数，禁止在页面里直接 `request.get`
- 查询参数接口（`XxxQuery`）与结果接口（`XxxListResult`）都要定义类型
- 统一使用 axios 实例 `request`（已封装 baseURL `/api`、超时、Cookie 携带）

## 7. 后端规范

### 7.1 路由层（server/routes/<模块>.js）

```js
// 角色管理路由 — CRUD

const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { getRoleList, insertRole, updateRole, deleteRole } = require("../db/roleApi");

const router = express.Router();

// 所有角色接口需登录
router.use(authMiddleware);

/**
 * 查询角色列表（分页 + 搜索）
 * GET /roles?roleName=&roleCode=&enabled=1&page=1&pageSize=10
 */
router.get("/", async (req, res) => {
  try {
    const { roleName = "", roleCode = "", enabled, page = 1, pageSize = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = [10, 20, 30].includes(parseInt(pageSize, 10)) ? parseInt(pageSize, 10) : 10;

    const { list, total } = await getRoleList({
      roleName: roleName.trim() || undefined,
      roleCode: roleCode.trim() || undefined,
      // enabled 为空字符串/未传时不作为查询条件
      enabled: enabled === "" || enabled === undefined ? undefined : Number(enabled),
      page: pageNum,
      pageSize: size,
    });

    res.json({ code: 0, data: { list, total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size) } });
  } catch (err) {
    console.error("查询角色列表失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});
```

**路由规范：**
- RESTful：`GET /`（列表）、`POST /`（新增）、`PUT /:id`（编辑）、`DELETE /:id`（删除）
- 列表返回 `{ code: 0, data: { list, total, page, pageSize, totalPages } }`
- 每个路由 `try/catch`，出错返回 `500 + { code: -1, msg }`
- 业务校验失败返回 `400 + { code: -1, msg }`；数据库唯一索引冲突（`ER_DUP_ENTRY`）给出友好提示
- 路由文件在 `server/index.js` 统一挂载：`app.use("/roles", require("./routes/roles"))`

### 7.2 数据层（server/db/<模块>Api.js）

```js
const getRoleList = ({ roleName, roleCode, enabled, page, pageSize }) => {
  return new Promise((resolve, reject) => {
    const conditions = [];
    const params = [];

    if (roleName) {
      conditions.push("role_name LIKE ?");
      params.push(`%${roleName}%`);
    }
    // enabled 精确匹配（0 禁用 / 1 启用）
    if (enabled === 0 || enabled === 1) {
      conditions.push("enabled = ?");
      params.push(enabled);
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    // 1. 查总数
    const countSQL = `SELECT COUNT(*) AS total FROM \`role\` ${whereClause}`;
    connection.query(countSQL, params, (err, countResult) => {
      if (err) return reject(err);
      const total = countResult[0]?.total || 0;

      // 2. 查分页数据（AS 别名转驼峰）
      const dataSQL = `
        SELECT role_id AS roleId, role_name AS roleName, role_code AS roleCode,
               description, enabled, create_time AS createTime
        FROM \`role\` ${whereClause}
        ORDER BY role_id ASC
        LIMIT ? OFFSET ?`;
      const offset = (page - 1) * pageSize;
      connection.query(dataSQL, [...params, pageSize, offset], (err, list) => {
        if (err) return reject(err);
        resolve({ list, total });
      });
    });
  });
};
```

**数据层规范：**
- **全部使用参数化查询（`?` 占位符），禁止字符串拼接 SQL**，防 SQL 注入
- 查询字段用 `AS` 别名转驼峰（`role_id AS roleId`），与前端字段对齐
- 模糊搜索用 `LIKE %xxx%`，枚举/状态字段用 `=` 精确匹配
- 分页固定「COUNT 查总数 + LIMIT/OFFSET 查数据」两步
- 函数返回 `Promise`，SQL 为空字段（如描述）落库 `null`

## 8. 硬性规则

1. **列表页必须使用 `useTable` + `JetSearchBar` + `JetTable`**，禁止手写数据请求 / 分页 / 搜索逻辑。
2. **弹窗必须使用 `DraggableDialog`**，禁止裸 `ElDialog`（详见弹窗规范）。
3. **`ElMessage` / `ElMessageBox` / `ElNotification` 禁止手动 `import`**，一律走 `unplugin-auto-import`，否则样式不注入（详见弹窗规范第 3 章硬性规则第 4 条）。
4. **删除（含批量）必须 `ElMessageBox.confirm` 二次确认**，成功后用 `refreshRemove()` 智能刷新。
5. **后端 SQL 必须参数化**，禁止拼接字符串。
6. **统一响应格式** `{ code, msg, data }`：成功 `code: 0`，失败 `code: -1`（HTTP 4xx/5xx 区分语义）。
7. **状态 0/1 字段**：前端 select 用字符串 `'0'`/`'1'` 传参，请求前转 `Number`，空字符串视为「不过滤」；展示层用 `formatter` 或 `ElTag` 转换，不直接显示数字。
8. **新增/编辑/删除后的刷新策略**：
   - 新增：`refreshCreate()`（回到第 1 页并清空分页缓存）
   - 编辑：`refreshUpdate()`（保持当前页）
   - 删除：`refreshRemove()`（智能处理页码，避免空页面）

## 9. 参考实现

| 文件 | 说明 |
|---|---|
| `client/src/pages/roleManage/index.vue` | CRUD 页面标杆（搜索 + 表格 + 增删改查） |
| `client/src/pages/roleManage/modules/role-edit-dialog.vue` | 新增 / 编辑共用弹窗 |
| `client/src/pages/roleManage/modules/role-view-dialog.vue` | 查看弹窗（ElDescriptions 只读展示） |
| `client/src/hooks/core/useTable.ts` | 表格数据管理 Hook（分页 / 搜索 / 缓存 / 刷新策略） |
| `client/src/utils/api.ts` | 统一请求封装与接口类型 |
| `server/routes/roles.js` | 后端 RESTful 路由 |
| `server/db/roleApi.js` | 后端数据层（参数化 SQL） |
