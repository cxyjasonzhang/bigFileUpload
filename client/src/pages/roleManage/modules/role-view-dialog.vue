<template>
  <DraggableDialog
    v-model="visible"
    title="查看角色"
    width="30%"
    align-center
    :close-on-click-modal="false"
  >
    <ElDescriptions :column="1" border>
      <ElDescriptionsItem label="角色名称">
        {{ roleData?.roleName ?? '-' }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="角色编码">
        {{ roleData?.roleCode ?? '-' }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="角色描述">
        {{ roleData?.description || '暂无描述' }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="启用状态">
        <ElTag :type="roleData?.enabled ? 'success' : 'info'">
          {{ roleData?.enabled ? '启用' : '禁用' }}
        </ElTag>
      </ElDescriptionsItem>
    </ElDescriptions>
    <template #footer>
      <ElButton type="primary" @click="handleClose">关闭</ElButton>
    </template>
  </DraggableDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DraggableDialog from '@/components/DraggableDialog.vue'

type RoleListItem = Api.SystemManage.RoleListItem

interface Props {
  modelValue: boolean
  roleData?: RoleListItem
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  roleData: undefined,
})

const emit = defineEmits<Emits>()

/**
 * 弹窗显示状态双向绑定
 */
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

/**
 * 关闭查看弹窗
 */
const handleClose = () => {
  visible.value = false
}
</script>
