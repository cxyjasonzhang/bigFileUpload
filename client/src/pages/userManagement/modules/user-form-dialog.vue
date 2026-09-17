<template>
  <DraggableDialog
    v-model="visible"
    :title="dialogType === 'add' ? '新增用户' : '编辑用户'"
    width="30%"
    align-center
    :close-on-click-modal="false"
    @closed="handleClose"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
      <ElFormItem label="姓名" prop="username">
        <ElInput v-model="form.username" placeholder="请输入姓名" maxlength="20" />
      </ElFormItem>
      <ElFormItem label="手机号" prop="phone">
        <ElInput v-model="form.phone" placeholder="请输入手机号" maxlength="11" />
      </ElFormItem>
      <ElFormItem label="家庭住址" prop="homeAddress">
        <ElInput v-model="form.homeAddress" placeholder="请输入家庭住址" maxlength="100" />
      </ElFormItem>
      <ElFormItem label="工作地点" prop="workLocation">
        <ElInput v-model="form.workLocation" placeholder="请输入工作地点" maxlength="100" />
      </ElFormItem>
      <ElFormItem label="角色" prop="roleIds">
        <ElSelect
          v-model="form.roleIds"
          multiple
          clearable
          placeholder="请选择角色（可不选）"
          style="width: 100%"
        >
          <ElOption
            v-for="role in roleOptions"
            :key="role.roleId"
            :label="role.roleName"
            :value="role.roleId"
          />
        </ElSelect>
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
import type { FormInstance, FormRules } from 'element-plus'
import DraggableDialog from '@/components/DraggableDialog.vue'
import { createUser, updateUser, fetchAllRoles, fetchUserRoles } from '@/utils/api'
import type { User, RoleItem } from '@/utils/api'

interface Props {
  modelValue: boolean
  dialogType: 'add' | 'edit'
  userData?: User
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  dialogType: 'add',
  userData: undefined,
})

const emit = defineEmits<Emits>()

const formRef = ref<FormInstance>()

/**
 * 弹窗显示状态双向绑定
 */
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

/**
 * 表单验证规则
 */
const rules = reactive<FormRules>({
  username: [
    { required: true, message: '请输入姓名', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '请输入正确的手机号', trigger: 'blur' },
  ],
  homeAddress: [{ max: 100, message: '长度在 100 个字符以内', trigger: 'blur' }],
  workLocation: [{ max: 100, message: '长度在 100 个字符以内', trigger: 'blur' }],
})

/**
 * 表单数据
 */
const form = reactive<User & { roleIds: number[] }>({
  id: 0,
  username: '',
  phone: '',
  homeAddress: '',
  workLocation: '',
  roleIds: [],
})

// 角色选项（全量可用角色，后端已过滤超级管理员）
const roleOptions = ref<RoleItem[]>([])

/**
 * 监听弹窗打开，初始化表单数据
 */
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) initForm()
  },
)

/**
 * 监听用户数据变化，更新表单
 */
watch(
  () => props.userData,
  (newData) => {
    if (newData && props.modelValue) initForm()
  },
  { deep: true },
)

/**
 * 加载全量可用角色选项（仅首次加载）
 */
async function loadRoleOptions() {
  try {
    const res = await fetchAllRoles()
    if (res.data.code === 0) {
      roleOptions.value = res.data.data.list
    }
  } catch {
    roleOptions.value = []
  }
}

/**
 * 加载用户已有角色 id 集合（编辑回显）
 * @param userId 用户 ID
 */
async function loadUserRoles(userId: number): Promise<number[]> {
  try {
    const res = await fetchUserRoles(userId)
    if (res.data.code === 0) {
      return res.data.data.roleIds
    }
  } catch {
    // 加载失败按无角色处理
  }
  return []
}

/**
 * 初始化表单数据
 * 根据弹窗类型填充表单或重置表单
 */
const initForm = async () => {
  // 角色选项只加载一次
  if (roleOptions.value.length === 0) {
    await loadRoleOptions()
  }

  if (props.dialogType === 'edit' && props.userData) {
    Object.assign(form, {
      id: props.userData.id,
      username: props.userData.username || '',
      phone: props.userData.phone || '',
      homeAddress: props.userData.homeAddress || '',
      workLocation: props.userData.workLocation || '',
    })
    // 编辑时回显用户已有角色
    form.roleIds = await loadUserRoles(props.userData.id)
  } else {
    Object.assign(form, {
      id: 0,
      username: '',
      phone: '',
      homeAddress: '',
      workLocation: '',
      roleIds: [],
    })
  }
}

/**
 * 关闭弹窗并重置表单
 * 在 DraggableDialog 的关闭动画结束后触发
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
 * 验证通过后调用接口保存数据
 */
const handleSubmit = async () => {
  if (!formRef.value || submitting.value) return

  try {
    await formRef.value.validate()
    submitting.value = true

    const payload = {
      username: form.username,
      // createUser 要求 phone 必填，空串由后端校验兜底
      phone: form.phone || '',
      homeAddress: form.homeAddress,
      workLocation: form.workLocation,
      roleIds: form.roleIds,
    }

    if (props.dialogType === 'add') {
      await createUser(payload)
    } else {
      await updateUser(form.id, payload)
    }

    const message = props.dialogType === 'add' ? '新增成功' : '修改成功'
    ElMessage.success(message)
    emit('success')
    handleClose()
  } catch (error: any) {
    // 接口报错时优先展示后端返回的错误信息（如「手机号格式不正确」）
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
