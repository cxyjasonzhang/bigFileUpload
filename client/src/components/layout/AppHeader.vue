<template>
  <div class="app-header">
    <div class="header-left">
      <!-- 侧栏收缩按钮 -->
      <el-button text @click="layout.toggleSidebar()">
        <el-icon size="20">
          <component :is="collapsed ? Expand : Fold" />
        </el-icon>
      </el-button>

      <!-- 全屏切换 -->
      <el-button text @click="toggleFullscreen">
        <el-icon size="18">
          <component :is="isFullscreen ? Aim : FullScreen" />
        </el-icon>
      </el-button>
    </div>

    <div class="header-right">
      <el-dropdown @command="handleCommand">
        <span class="user-info">
          👤 {{ authState.user?.name || authState.user?.username }}
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">个人信息</el-dropdown-item>
            <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import {
  Expand,
  Fold,
  FullScreen,
  Aim,
  ArrowDown,
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { authState, logout } from "@/utils/auth";
import { useLayoutStore } from "@/stores/layout";

const router = useRouter();
const layout = useLayoutStore();
const collapsed = computed(() => layout.collapsed);
const isFullscreen = ref(false);

// 同步系统全屏状态（如用户按 ESC 退出全屏时图标也能正确回弹）
function syncFullscreen() {
  isFullscreen.value = !!document.fullscreenElement;
}

onMounted(() => {
  document.addEventListener("fullscreenchange", syncFullscreen);
});

onUnmounted(() => {
  document.removeEventListener("fullscreenchange", syncFullscreen);
});

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
}

async function handleCommand(cmd: string) {
  if (cmd === "logout") {
    await logout();
    ElMessage.success("已退出登录");
    router.push("/login");
  } else if (cmd === "profile") {
    ElMessage.info("个人信息功能开发中");
  }
}
</script>

<style scoped>
.app-header {
  height: 56px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #333;
  font-size: 14px;
}
</style>
