# ADR-0004: 角色新增/编辑弹窗与操作列接入

## 状态

已采纳（2026-08-12）

## 背景

角色管理页（`pages/roleManage/index.vue`）已完成列表对接（ADR-0003），但「新增角色」按钮和操作列的编辑/删除仍是占位实现，需要接入真实接口。

## 决策

### 弹窗组件自闭环

`modules/role-edit-dialog.vue` 负责弹窗内全部逻辑：

- 打开时初始化表单（`initForm`）：`add` 类型重置表单；`edit` 类型用 `roleData` 回填
- 提交时自校验（`el-form` rules）并调用接口：`add` → `fetchCreateRole`，`edit` → `fetchUpdateRole(roleId, ...)`
- 成功后 `ElMessage.success` + `emit('success')` + 关闭弹窗，**列表页监听 `success` 事件刷新数据**，不做任何接口调用
- 组件内部不依赖外部状态，通过 props（`modelValue` / `dialogType` / `roleData`）驱动

### enabled 布尔/数字转换

- 后端 `role` 表 `enabled` 为 `TINYINT(1)`，接口返回 `0/1`
- 弹窗内 `el-switch` 绑定布尔值：编辑回填时 `enabled === 1 || enabled === true` 转布尔
- 提交时 `enabled ? 1 : 0` 转回数字传给接口

### 列表页操作列

| 按钮 | 行为 |
|---|---|
| 查看 | 保留轻提示（暂无详情接口） |
| 编辑 | 打开弹窗，`dialogType='edit'` + 传入 `roleData` |
| 删除 | `ElMessageBox.confirm` 确认 → `fetchDeleteRole(roleId)` → `refreshRemove()` 智能刷新页码 |

### 批量删除

- 确认后 `Promise.all` 循环调用 `fetchDeleteRole(roleId)` 逐条删除
- 成功后清空选中项并 `refreshRemove()` 刷新

### 涉及文件

| 文件 | 改动 |
|---|---|
| `client/src/pages/roleManage/modules/role-edit-dialog.vue` | 补 Vue API 导入；`initForm` 处理 enabled 转换；`handleSubmit` 调用新增/编辑接口；补充 `submitting` 防重复提交 |
| `client/src/pages/roleManage/index.vue` | 接入 `RoleEditDialog`；实现 `handleAdd` / `handleEdit` / `handleDelete` / 批量删除 |

## 后果

- **正面**：新增/编辑/删除全链路打通，交互闭环在弹窗组件内自洽
- **正面**：`success` 事件解耦父子职责，弹窗可复用
- **风险**：`roleCode` 唯一冲突时接口返回「角色编码已存在」，前端 catch 中优先展示 `response.data.msg`
