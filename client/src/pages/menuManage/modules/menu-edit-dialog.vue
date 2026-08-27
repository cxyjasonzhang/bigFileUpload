<template>
  <DraggableDialog
    v-model="visible"
    :title="dialogType === 'add' ? '新增菜单' : '编辑菜单'"
    width="42%"
    align-center
    :close-on-click-modal="false"
    @closed="handleClose"
  >
    <!-- validate-on-rule-change=false：切换菜单类型更新 rules 时不触发即时校验，只在提交/失焦时校验 -->
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px" :validate-on-rule-change="false">
      <ElFormItem label="菜单类型">
        <ElRadioGroup v-model="form.menuType">
          <ElRadioButton :value="0">目录</ElRadioButton>
          <ElRadioButton :value="1">菜单</ElRadioButton>
          <ElRadioButton :value="2">按钮</ElRadioButton>
        </ElRadioGroup>
      </ElFormItem>

      <ElFormItem label="父级菜单" prop="parentId">
        <ElTreeSelect
          v-model="form.parentId"
          :data="parentTreeData"
          :props="parentTreeProps"
          node-key="menuId"
          check-strictly
          :render-after-expand="false"
          placeholder="请选择父级菜单，不选则为顶级"
          style="width: 100%"
        />
      </ElFormItem>

      <ElFormItem label="菜单名称" prop="menuName">
        <ElInput v-model="form.menuName" placeholder="请输入菜单名称" maxlength="50" show-word-limit />
      </ElFormItem>

      <!-- 菜单类型才需要路由地址 -->
      <ElFormItem v-if="form.menuType === 1" label="路由地址" prop="path">
        <ElInput v-model="form.path" placeholder="如 /system/role" maxlength="200" />
      </ElFormItem>

      <!-- 菜单类型才需要组件地址（动态路由渲染组件依赖） -->
      <ElFormItem v-if="form.menuType === 1" label="组件地址" prop="component">
        <ElInput v-model="form.component" placeholder="如 roleManage/index" maxlength="200" />
      </ElFormItem>

      <!-- 按钮类型必填权限标识，菜单类型可选 -->
      <ElFormItem v-if="form.menuType !== 0" label="权限标识" prop="perms">
        <ElInput v-model="form.perms" placeholder="如 system:role:add" maxlength="100" />
      </ElFormItem>

      <!-- 按钮无图标概念 -->
      <ElFormItem v-if="form.menuType !== 2" label="图标" prop="icon">
        <ElInput v-model="form.icon" placeholder="图标类名，如 Edit" maxlength="100" />
      </ElFormItem>

      <!-- 仅菜单类型可嵌入 iframe -->
      <ElFormItem v-if="form.menuType === 1" label="iframe 嵌入">
        <ElSwitch v-model="form.isIframe" :active-value="1" :inactive-value="0" />
      </ElFormItem>

      <!-- 仅菜单类型可全屏展示（打开时隐藏侧边栏/顶栏/Tab，整页独立展示） -->
      <ElFormItem v-if="form.menuType === 1" label="全屏展示">
        <ElSwitch v-model="form.isFullScreen" :active-value="1" :inactive-value="0" />
        <span class="form-tip">开启后隐藏侧边栏/顶栏，整页独立展示</span>
      </ElFormItem>

      <ElFormItem label="排序号" prop="orderNum">
        <ElInputNumber v-model="form.orderNum" :min="-9999" :max="9999" controls-position="right" />
        <span class="form-tip">数值越小越靠前</span>
      </ElFormItem>

      <ElFormItem label="状态">
        <ElSwitch v-model="form.status" :active-value="0" :inactive-value="1" />
        <span class="form-tip">{{ form.status === 0 ? '正常' : '停用' }}</span>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="handleClose">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">提交</ElButton>
    </template>
  </DraggableDialog>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue'
  import type { FormInstance, FormRules, TreeOptionProps } from 'element-plus'
  import DraggableDialog from '@/components/DraggableDialog.vue'
  import { fetchCreateMenu, fetchUpdateMenu } from '@/utils/api'
  import type { MenuItemPayload, MenuType } from '@/utils/api'
  import type { MenuItem, MenuTree } from '@/types/system/menu'

  type MenuListItem = MenuItem

  /** 菜单树节点（平铺数据组装后的结构） */
  type MenuTreeNode = MenuTree

  interface Props {
    modelValue: boolean
    dialogType: 'add' | 'edit'
    /** 编辑时的菜单数据 */
    menuData?: MenuListItem
    /** 全量菜单树（父级选择器数据源，弹窗内会过滤按钮节点与自身子树） */
    menuTree: MenuTreeNode[]
    /** 新增模式下的默认父级 ID（「新增下级」时预选父级，0 表示根目录） */
    defaultParentId?: number
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    dialogType: 'add',
    menuData: undefined,
    menuTree: () => [],
    defaultParentId: 0
  })

  const emit = defineEmits<Emits>()

  const formRef = ref<FormInstance>()

  /**
   * 弹窗显示状态双向绑定
   */
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  /**
   * 菜单类型文案
   */
  const menuTypeText = computed(() => (form.menuType === 0 ? '目录' : form.menuType === 1 ? '菜单' : '按钮'))

  /**
   * 表单验证规则（path/perms 的必填随菜单类型动态变化）
   */
  const rules = reactive<FormRules>({
    menuName: [
      { required: true, message: '请输入菜单名称', trigger: 'blur' },
      { max: 50, message: '长度在 50 个字符以内', trigger: 'blur' }
    ],
    path: [{ required: false, message: '请输入路由地址', trigger: 'blur' }],
    component: [{ required: false, message: '请输入组件地址', trigger: 'blur' }],
    perms: [{ required: false, message: '请输入权限标识', trigger: 'blur' }],
    icon: [{ max: 100, message: '长度在 100 个字符以内', trigger: 'blur' }],
    orderNum: [{ required: true, message: '请输入排序号', trigger: 'blur' }]
  })

  /**
   * 表单数据
   * status/isIframe 遵循后端 0/1 约定：status 0-正常 1-停用
   */
  const form = reactive<MenuListItem>({
    menuId: 0,
    parentId: 0,
    menuName: '',
    menuType: 0,
    path: '',
    component: '',
    perms: '',
    icon: '',
    orderNum: 0,
    isIframe: 0,
    isFullScreen: 0,
    status: 0
  })

  /**
   * 监听菜单类型变化，动态切换 path/component/perms 的必填校验
   * 说明：配合 ElForm 的 validate-on-rule-change=false，切换类型仅更新规则，不触发即时校验
   */
  watch(
    () => form.menuType,
    (type) => {
      rules.path = [{ required: type === 1, message: '菜单类型必须填写路由地址', trigger: 'blur' }]
      rules.component = [{ required: type === 1, message: '菜单类型必须填写组件地址', trigger: 'blur' }]
      rules.perms = [{ required: type === 2, message: '按钮类型必须填写权限标识', trigger: 'blur' }]
    },
    { immediate: true }
  )

  /**
   * 父级选择器字段映射
   * 说明：value 字段运行时有效，但 Element Plus 的 TreeOptionProps 类型未声明它，故用交叉类型补全
   */
  const parentTreeProps = {
    label: 'menuName',
    value: 'menuId',
    children: 'children'
  } as TreeOptionProps & { value: string }

  /**
   * 过滤出可作为父级的树：剔除按钮类型节点；编辑时再剔除自身及其子孙
   */
  const parentTreeData = computed(() => {
    let tree = filterButtonNodes(props.menuTree)
    if (props.dialogType === 'edit' && props.menuData) {
      tree = removeSubtree(tree, props.menuData.menuId)
    }
    return [
      {
        menuId: 0,
        menuName: '根目录',
        children: tree
      }
    ]
  })

  /**
   * 递归剔除按钮类型节点（按钮不能作为父级）
   */
  const filterButtonNodes = (nodes: MenuTreeNode[]): MenuTreeNode[] =>
    nodes
      .filter((node) => node.menuType !== 2)
      .map((node) => ({
        ...node,
        children: node.children ? filterButtonNodes(node.children) : []
      }))

  /**
   * 递归剔除某节点及其子孙（编辑时防止选择自己或自己的子级）
   */
  const removeSubtree = (nodes: MenuTreeNode[], id: number): MenuTreeNode[] =>
    nodes
      .filter((node) => node.menuId !== id)
      .map((node) => ({
        ...node,
        children: node.children ? removeSubtree(node.children, id) : []
      }))

  /**
   * 监听弹窗打开，初始化表单数据
   */
  watch(
    () => props.modelValue,
    (newVal) => {
      if (newVal) initForm()
    }
  )

  /**
   * 监听菜单数据变化，更新表单
   */
  watch(
    () => props.menuData,
    (newData) => {
      if (newData && props.modelValue) initForm()
    },
    { deep: true }
  )

  /**
   * 初始化表单数据：编辑填充、新增重置
   */
  const initForm = () => {
    if (props.dialogType === 'edit' && props.menuData) {
      // 数据库空值（null）统一归一化为空串/0，避免表单控件告警与提交异常
      Object.assign(form, props.menuData, {
        parentId: props.menuData.parentId ?? 0,
        menuName: props.menuData.menuName ?? '',
        path: props.menuData.path ?? '',
        component: props.menuData.component ?? '',
        perms: props.menuData.perms ?? '',
        icon: props.menuData.icon ?? '',
        orderNum: props.menuData.orderNum ?? 0,
        isIframe: props.menuData.isIframe ?? 0,
        isFullScreen: props.menuData.isFullScreen ?? 0,
        status: props.menuData.status ?? 0
      })
    } else {
      Object.assign(form, {
        menuId: 0,
        parentId: props.defaultParentId ?? 0,
        menuName: '',
        menuType: 0,
        path: '',
        component: '',
        perms: '',
        icon: '',
        orderNum: 0,
        isIframe: 0,
        isFullScreen: 0,
        status: 0
      })
    }
  }

  /**
   * 关闭弹窗并重置表单
   */
  const handleClose = () => {
    visible.value = false
    formRef.value?.resetFields()
  }

  /**
   * 提交中状态，防止重复提交
   */
  const submitting = ref(false)

  /**
   * 提交表单
   */
  const handleSubmit = async () => {
    if (!formRef.value || submitting.value) return

    try {
      await formRef.value.validate()
      submitting.value = true

      const payload: MenuItemPayload = {
        parentId: form.parentId,
        menuName: form.menuName,
        menuType: form.menuType as MenuType,
        path: form.path,
        component: form.component,
        // perms 可能为 null（数据库空值），提交时归一化为 undefined
        perms: form.perms ?? undefined,
        icon: form.icon,
        orderNum: form.orderNum,
        isIframe: form.isIframe,
        isFullScreen: form.isFullScreen,
        status: form.status
      }

      if (props.dialogType === 'add') {
        await fetchCreateMenu(payload)
      } else {
        await fetchUpdateMenu(form.menuId, payload)
      }

      const message = props.dialogType === 'add' ? `新增${menuTypeText.value}成功` : `编辑${menuTypeText.value}成功`
      ElMessage.success(message)
      emit('success')
      handleClose()
    } catch (error: any) {
      // 接口报错时优先展示后端返回的错误信息（如「按钮类型必须填写权限标识」）
      if (error?.response?.data?.msg) {
        ElMessage.error(error.response.data.msg)
      } else {
        console.log('提交失败:', error)
      }
    } finally {
      submitting.value = false
    }
  }
</script>

<style scoped>
  .form-tip {
    margin-left: 8px;
    font-size: 12px;
    color: var(--app-text-secondary, #909399);
  }
</style>
