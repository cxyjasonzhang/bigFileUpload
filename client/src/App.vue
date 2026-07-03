<template>
  <div class="app-container">
    <h1>大文件上传</h1>

    <!-- 未登录 → 登录页 -->
    <Login
      v-if="!authState.isLoggedIn"
      @login-success="onLoginSuccess"
    />

    <!-- 已登录 → 上传页 -->
    <template v-else>
      <div class="user-bar">
        <span class="user-info">
          👤 {{ authState.user?.name || authState.user?.username }}
        </span>
        <el-button type="danger" size="small" text @click="handleLogout">
          退出登录
        </el-button>
      </div>
      <FileUpload />
    </template>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { ElMessage } from "element-plus";
import FileUpload from "./components/FileUpload.vue";
import Login from "./components/Login.vue";
import { authState, logout, initAuth } from "./utils/auth.js";

function onLoginSuccess() {
  // 登录成功后刷新 FileUpload 组件（重新挂载以恢复队列）
}

async function handleLogout() {
  await logout();
  ElMessage.success("已退出登录");
}

onMounted(async () => {
  // 尝试用 refresh_token 恢复登录态
  await initAuth();
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.app-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 40px 20px;
}

h1 {
  text-align: center;
  color: #fff;
  margin-bottom: 30px;
  font-size: 28px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.user-bar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
}

.user-info {
  color: #fff;
  font-size: 14px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
</style>
