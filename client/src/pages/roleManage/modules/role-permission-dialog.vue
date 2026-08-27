<template>
  <DraggableDialog
    v-model="visible"
    :title="`分配权限 - ${roleData?.roleName ?? ''}`"
    width="36%"
    align-center
    :close-on-click-modal="false"
    @closed="handleClose"
  >
    <div class="perm-body">
      <ElAlert type="info" :closable="false" show-icon class="mb-3">
        <template #title>
          勾选要授予该角色的菜单与按钮权限，保存后即时生效
        </template>
      </ElAlert>

      <div class="perm-tree-wrap">
        <ElTree
          ref="treeRef"
          :data="menuTree"
          :props="{ label: 'menuName', children: 'children' }"
          node-key="menuId"
          show-checkbox
          :default-checked-keys="checkedKeys"
          default-expand-all
        />
      </div>
    </div>
    <template #footer>
      <ElButton @click="handleClose">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">保存</ElButton>
    </template>
  </DraggableDialog>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import type { ElTree } from 'element-plus'
  import DraggableDialog from '@/components/DraggableDialog.vue'
  import { fetchAllMenus, fetchRoleMenuIds, saveRoleMenus } from '@/utils/api'
  import type { MenuItem, MenuTree } from '@/types/router'

  type RoleListItem = Api.SystemManage.RoleListItem

  interface Props {
    modelValue: boolean
    roleData?: RoleListItem
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    roleData: undefined
  })

  const emit = defineEmits<Emits>()

  const treeRef = ref<InstanceType<typeof ElTree>>()
  const submitting = ref(false)
  const menuTree = ref<MenuTree[]>([])
  /** 当前角色已授权的 menu_id 集合 */
  const checkedKeys = ref<number[]>([])

  /**
   * 弹窗显示状态双向绑定
   */
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  /**
   * 平铺菜单组装成树（授权树含目录/菜单/按钮三层）
   */
  const buildTree = (list: MenuItem[]): MenuTree[] => {
    const map = new Map<number, MenuTree>()
    list.forEach((item) => map.set(item.menuId, { ...item, children: [] }))
    const roots: MenuTree[] = []
    list.forEach((item) => {
      const node = map.get(item.menuId)!
      if (item.parentId === 0 || !map.has(item.parentId)) {
        roots.push(node)
      } else {
        map.get(item.parentId)!.children!.push(node)
      }
    })
    return roots
  }

  /**
   * 加载全量菜单树 + 当前角色授权
   */
  const loadData = async () => {
    if (!props.roleData) return
    try {
      const [menuRes, permRes] = await Promise.all([
        fetchAllMenus(),
        fetchRoleMenuIds(props.roleData.roleId)
      ])
      menuTree.value = buildTree(menuRes.data.data.list)
      checkedKeys.value = permRes.data.data.menuIds
    } catch (error: any) {
      if (error?.response?.data?.msg) {
        ElMessage.error(error.response.data.msg)
      }
    }
  }

  /**
   * 监听弹窗打开，加载数据
   */
  watch(
    () => props.modelValue,
    (newVal) => {
      if (newVal) loadData()
    }
  )

  /**
   * 关闭弹窗
   */
  const handleClose = () => {
    visible.value = false
  }

  /**
   * 提交授权
   */
  const handleSubmit = async () => {
    if (!props.roleData || submitting.value) return
    try {
      submitting.value = true
      // 获取勾选的节点（含半选父节点）
      const checked = treeRef.value?.getCheckedKeys(false) as number[]
      const halfChecked = treeRef.value?.getHalfCheckedKeys() as number[]
      const menuIds = [...checked, ...halfChecked].map(Number)

      await saveRoleMenus(props.roleData.roleId, menuIds)
      ElMessage.success('保存授权成功')
      emit('success')
      handleClose()
    } catch (error: any) {
      if (error?.response?.data?.msg) {
        ElMessage.error(error.response.data.msg)
      }
    } finally {
      submitting.value = false
    }
  }
</script>

<style scoped>
  .perm-body {
    min-height: 360px;
  }
  .perm-tree-wrap {
    max-height: 460px;
    overflow-y: auto;
    border: 1px solid var(--app-border);
    border-radius: 4px;
    padding: 8px;
  }
</style>
