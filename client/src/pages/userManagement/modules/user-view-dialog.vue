<template>
  <DraggableDialog
    v-model="visible"
    title="查看用户"
    width="30%"
    align-center
    :close-on-click-modal="false"
  >
    <ElDescriptions :column="1" border>
      <ElDescriptionsItem label="姓名">
        {{ userData?.username ?? '-' }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="手机号">
        {{ userData?.phone ?? '-' }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="家庭住址">
        {{ userData?.homeAddress || '暂无' }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="工作地点">
        {{ userData?.workLocation || '暂无' }}
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
  import type { User } from '@/utils/api'

  interface Props {
    modelValue: boolean
    userData?: User
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    userData: undefined
  })

  const emit = defineEmits<Emits>()

  /**
   * 弹窗显示状态双向绑定
   */
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  /**
   * 关闭查看弹窗
   */
  const handleClose = () => {
    visible.value = false
  }
</script>
