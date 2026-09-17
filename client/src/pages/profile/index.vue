<template>
  <div class="profile-page">
    <el-card shadow="never">
      <template #header>
        <span class="page-title">个人中心</span>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" class="profile-form">
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称（显示名）" maxlength="50" />
        </el-form-item>

        <el-form-item label="姓名" prop="username">
          <el-input v-model="form.username" placeholder="请输入姓名" maxlength="50" />
        </el-form-item>

        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="form.gender">
            <el-radio :value="0">未设置</el-radio>
            <el-radio :value="1">男</el-radio>
            <el-radio :value="2">女</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="选填，如 example@mail.com" maxlength="100" />
        </el-form-item>

        <el-form-item label="手机" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" maxlength="11" />
        </el-form-item>

        <el-form-item label="联系地址" prop="homeAddress">
          <el-input v-model="form.homeAddress" placeholder="请输入联系地址" maxlength="200" />
        </el-form-item>

        <el-form-item label="个人介绍" prop="bio">
          <el-input
            v-model="form.bio"
            type="textarea"
            :rows="4"
            placeholder="简单介绍一下自己"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
// 个人中心：展示并编辑当前登录用户的个人资料
import { ref, reactive, onMounted } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { fetchUserProfile, updateUserProfile, type UserProfile } from '@/utils/api'

defineOptions({ name: 'Profile' })

const formRef = ref<FormInstance | null>(null)
const saving = ref(false)

// 个人资料表单（id 由后端从 token 取，前端不持有）
const form = reactive<Omit<UserProfile, 'id'>>({
  username: '',
  nickname: '',
  gender: 0,
  email: '',
  phone: '',
  homeAddress: '',
  bio: '',
})

// 校验规则：姓名/手机必填；邮箱选填，填了校验格式
const rules: FormRules = {
  username: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
  email: [{ pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '邮箱格式不正确', trigger: 'blur' }],
}

// 进入页面时加载当前用户资料
onMounted(async () => {
  try {
    const res = await fetchUserProfile()
    if (res.data.code === 0 && res.data.data) {
      const d = res.data.data
      form.username = d.username ?? ''
      form.nickname = d.nickname ?? ''
      form.gender = d.gender ?? 0
      form.email = d.email ?? ''
      form.phone = d.phone ?? ''
      form.homeAddress = d.homeAddress ?? ''
      form.bio = d.bio ?? ''
    }
  } catch {
    ElMessage.error('加载个人资料失败')
  }
})

/** 保存个人资料 */
async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await updateUserProfile({ ...form })
    ElMessage.success('保存成功')
  } catch (err: any) {
    ElMessage.error(err.response?.data?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.profile-page {
  .profile-form {
    max-width: 560px;
  }
}
</style>
