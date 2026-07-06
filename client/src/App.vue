<template>
  <div class="app-container">
    <h1>大文件上传 &amp; 用户管理</h1>

    <!-- 未登录 → 登录页 -->
    <Login
      v-if="!authState.isLoggedIn"
      @login-success="onLoginSuccess"
    />

    <!-- 已登录 → 功能页 -->
    <template v-else>
      <div class="user-bar">
        <span class="user-info">
          👤 {{ authState.user?.name || authState.user?.username }}
        </span>
        <el-button type="danger" size="small" text @click="handleLogout">
          退出登录
        </el-button>
      </div>

      <el-tabs v-model="activeTab" type="border-card" class="main-tabs">
        <el-tab-pane label="📁 文件上传" name="upload">
          <FileUpload />
        </el-tab-pane>
        <el-tab-pane label="👥 用户管理" name="users">
          <UserManagement />
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import FileUpload from "@/pages/fileUpload/index.vue";
import Login from "@/pages/login/index.vue";
import UserManagement from "@/pages/userManagement/index.vue";
import { authState, logout, initAuth } from "@/utils/auth.js";

const activeTab = ref("upload");

function onLoginSuccess() {
  activeTab.value = "upload";
}

async function handleLogout() {
  await logout();
  ElMessage.success("已退出登录");
}

onMounted(async () => {
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
  max-width: 1000px;
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

.main-tabs {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.main-tabs :deep(.el-tabs__content) {
  padding: 0;
}

.main-tabs :deep(.el-tab-pane) {
  padding: 20px;
  background: #fff;
}
</style>
