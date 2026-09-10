# 弹窗开发规范

> 适用范围：`client/` 前端所有弹窗（Dialog）相关开发。
> 建立背景：角色管理弹窗改造时统一收口到 `DraggableDialog`（见 `docs/adr/0004-role-edit-dialog.md`）。

## 1. 统一容器：使用 DraggableDialog

所有弹窗必须以 `client/src/components/DraggableDialog.vue` 为基础容器，**禁止直接用裸 `ElDialog`**。

`DraggableDialog` 提供的能力：

- 拖拽移动（默认开启，拖拽时自动限制在视口内）
- 全屏切换（默认开启，全屏时 header / body / footer 自适应布局）
- 自定义 header：标题 + 全屏按钮 + 关闭按钮
- `width`、`align-center`、`close-on-click-modal` 等属性通过 `$attrs` 透传给内部 `el-dialog`

## 2. 基础用法

```vue
<DraggableDialog
  v-model="visible"
  :title="dialogType === 'add' ? '新增角色' : '编辑角色'"
  width="30%"
  align-center
  :close-on-click-modal="false"
  @closed="handleClose"
>
  <!-- 默认插槽：弹窗主体（表单等） -->
  <ElForm>...</ElForm>

  <!-- 底部按钮区 -->
  <template #footer>
    <ElButton @click="handleClose">取消</ElButton>
    <ElButton type="primary" :loading="submitting" @click="handleSubmit">提交</ElButton>
  </template>
</DraggableDialog>
```

## 3. 硬性规则

1. **表单重置挂 `@closed`，不挂 `@close`**
   `DraggableDialog` 的右上角关闭按钮直接 emit `update:modelValue(false)`，不会触发 `el-dialog` 的 `close` 事件。因此表单 `resetFields` 等清理逻辑必须放在 `@closed`（关闭动画结束后触发），保证任何关闭方式（右上角 X / ESC / 遮罩 / 外部设置）都能正确重置。
2. **表单弹窗必须设置 `:close-on-click-modal="false"`**
   防止填写过程中误点遮罩关闭、丢失已输入的数据。
3. **主操作按钮必须带 `:loading="submitting"`**
   配合 `submitting` 状态实现防重复提交，保存中按钮呈 loading 态。
4. **`ElMessage` / `ElMessageBox` / `ElNotification` 禁止手动 `import`**
   这类 JS API 组件不走模板解析，样式只能靠 import 注入。若手动 `import { ElMessageBox } from 'element-plus'`，`unplugin-auto-import` 会检测到已手动导入并**跳过该文件**，导致样式不注入——最终 `.el-message-box` 等样式只会出现在其他懒加载页面的私有 CSS chunk 里，表现为「直接进页面弹窗裸奔，先访问过某页面才有样式」。
   正确做法：一律让 `unplugin-auto-import` 自动导入（类型声明由 `auto-imports.d.ts` 提供，IDE 提示不受影响）。

   ```ts
   // ✅ 正确：不写 import，直接用
   ElMessageBox.confirm('确定删除该角色吗？', '提示', { type: 'warning' })
   ElMessage.success('保存成功')

   // ❌ 错误：手动 import 会阻断样式自动注入
   // import { ElMessageBox } from 'element-plus'
   ```

## 4. 表单弹窗组件结构约定

参考 `client/src/pages/roleManage/modules/role-edit-dialog.vue`：

- **Props**：`modelValue: boolean`、`dialogType: 'add' | 'edit'`、行数据（编辑时可选）
- **Emits**：`update:modelValue`、`success`（保存成功后通知父组件刷新列表）
- **可见性**：用 `computed` 对 `props.modelValue` 做双向绑定
- **初始化**：`watch` 监听 `modelValue`，打开时调用 `initForm()`——新增重置表单、编辑回填数据；后端 0/1 字段与表单布尔值做 `!!value` 转换
- **提交**：`validate()` → 组装 payload（布尔值转 0/1）→ 调接口 → 成功 `ElMessage.success` + `emit('success')` + 关闭弹窗；失败优先展示后端返回的 `msg`
- **防重**：`submitting` 状态 + 提交按钮 loading
- **弹窗关闭后**：通过 `@closed` 触发 `resetFields()`，保证下次打开是干净表单

## 5. 参考实现

| 文件 | 说明 |
|---|---|
| `client/src/components/DraggableDialog.vue` | 容器组件（拖拽 / 全屏 / header） |
| `client/src/components/UserFormDialog.vue` | 用户表单弹窗示例 |
| `client/src/pages/iconManager/components/IconFormDialog.vue` | 图标导入 / 编辑弹窗示例 |
| `client/src/pages/iconManager/components/GroupFormDialog.vue` | 分组新建 / 编辑弹窗示例 |
| `client/src/pages/roleManage/modules/role-edit-dialog.vue` | 角色新增 / 编辑弹窗示例（接接口 + 防重） |
