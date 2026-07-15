<template>
  <DraggableDialog
    v-model="visible"
    :title="isEdit ? '编辑分组' : '新建分组'"
    width="480px"
    :close-on-click-modal="false"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="显示名称" prop="name">
        <el-input
          v-model="form.name"
          placeholder="请输入分组显示名称，如「对象图标」"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="标识(slug)" prop="slug">
        <el-input
          v-model="form.slug"
          placeholder="小写字母、数字、短横线，如 object"
          maxlength="100"
          show-word-limit
        >
          <template #append>{{ form.slug || 'slug' }}</template>
        </el-input>
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          placeholder="可选，分组描述"
          :rows="3"
          maxlength="255"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleConfirm">
        {{ isEdit ? '保存' : '创建' }}
      </el-button>
    </template>
  </DraggableDialog>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue'
import { type FormInstance } from 'element-plus'
import DraggableDialog from '@/components/DraggableDialog.vue'

const props = withDefaults(
  defineProps<{
    isEdit?: boolean
  }>(),
  {
    isEdit: false,
  },
)

const emit = defineEmits<{
  (e: 'confirm', data: Record<string, unknown>): void
}>()

const visible = ref(false)
const formRef = ref<FormInstance | null>(null)
const submitting = ref(false)

const form = reactive({
  name: '',
  slug: '',
  description: '',
  sortOrder: 0,
})

// 校验规则
const rules = {
  name: [{ required: true, message: '请输分组显示名称', trigger: 'blur' }],
  slug: [
    { required: true, message: '请输入分组标识', trigger: 'blur' },
    { pattern: /^[a-z0-9-]+$/, message: '仅允许小写字母、数字、短横线', trigger: 'blur' },
  ],
}

/**
 * 打开弹窗，初始化表单数据
 * @param {Object|null} data 编辑时传入分组数据，新建时传 null
 */
function open(data) {
  if (data) {
    form.name = data.name || ''
    form.slug = data.slug || ''
    form.description = data.description || ''
  } else {
    form.name = ''
    form.slug = ''
    form.description = ''
  }
  // 仅清除校验状态，避免 resetFields 把已回显的字段值重置为空
  nextTick(() => formRef.value?.clearValidate())
  visible.value = true
}

function close() {
  visible.value = false
}

async function handleConfirm() {
  const valid = formRef.value ? await formRef.value.validate().catch(() => false) : false
  if (!valid) return

  submitting.value = true
  emit('confirm', { ...form })
  submitting.value = false
}

defineExpose({ open, close })
</script>
