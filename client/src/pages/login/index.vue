<template>
  <div class="login-card">
    <div class="login-header">
      <h2>大文件上传系统</h2>
      <p class="login-subtitle">请登录后使用</p>
    </div>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="handleLogin"
    >
      <el-form-item label="用户名" prop="username">
        <el-input
          v-model="form.username"
          placeholder="请输入用户名"
          :prefix-icon="User"
          size="large"
        />
      </el-form-item>

      <el-form-item label="密码" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          placeholder="请输入密码"
          :prefix-icon="Lock"
          size="large"
          show-password
          @keyup.enter="handleLogin"
        />
      </el-form-item>

      <el-form-item>
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          class="login-btn"
          @click="handleLogin"
        >
          {{ loading ? "登录中..." : "登 录" }}
        </el-button>
      </el-form-item>
    </el-form>

    <div class="login-hint">
      Demo 账号：admin / admin123
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
import { User, Lock } from "@element-plus/icons-vue";
import { ElMessage, type FormInstance } from "element-plus";
import { login } from "@/utils/auth";

const route = useRoute();
const router = useRouter();

const formRef = ref<FormInstance | null>(null);
const loading = ref(false);
const form = reactive({
  username: "admin",
  password: "admin123",
});

const rules = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    await login(form.username, form.password);
    ElMessage.success("登录成功");
    // 回跳到登录前意图访问的路由（默认工作台）
    const redirect = (route.query.redirect as string) || "/workbench";
    router.push(redirect);
  } catch (err) {
    ElMessage.error((err as Error).message || "登录失败，请检查用户名和密码");
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
@use "./index.scss";
</style>
