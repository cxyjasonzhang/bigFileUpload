<template>
  <div class="workbench">
    <el-card class="welcome-card" shadow="never">
      <h2>👋 欢迎回来，{{ authState.user?.name || authState.user?.username }}</h2>
      <p class="welcome-desc">
        这是一个大文件上传与图标管理系统，请从下方卡片或左侧菜单进入对应模块。
      </p>
    </el-card>

    <div class="entry-grid">
      <el-card
        v-for="item in entries"
        :key="item.path"
        class="entry-card"
        shadow="hover"
        @click="go(item.path)"
      >
        <div class="entry-icon">
          <el-icon size="36"><component :is="item.icon" /></el-icon>
        </div>
        <h3>{{ item.menuName }}</h3>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { usePermissionStore } from "@/stores/permission";
import { authState } from "@/utils/auth";

defineOptions({ name: "Workbench" });

const permission = usePermissionStore();
const { menuTree } = storeToRefs(permission);

// 从动态菜单树扁平化出「菜单」节点（menuType=1），工作台不显示在入口卡片里
const entries = computed(() => {
  const flatten = (nodes: any[]): any[] =>
    nodes.flatMap((n) => [
      ...(n.menuType === 1 ? [n] : []),
      ...(n.children ? flatten(n.children) : []),
    ]);
  return flatten(menuTree.value).filter((m) => m.path !== "/workbench");
});

const router = useRouter();
function go(path: string) {
  router.push(path);
}
</script>

<style scoped>
.workbench {
  padding: 8px;
}

.welcome-card {
  margin-bottom: 16px;
  border-radius: 12px;
}

.welcome-card h2 {
  font-size: 20px;
  margin-bottom: 8px;
}

.welcome-desc {
  color: var(--app-text-secondary);
  font-size: 14px;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.entry-card {
  cursor: pointer;
  border-radius: 12px;
  transition: transform 0.15s;
}

.entry-card:hover {
  transform: translateY(-4px);
}

.entry-icon {
  color: var(--el-color-primary);
  margin-bottom: 12px;
}

.entry-card h3 {
  font-size: 16px;
  margin-bottom: 6px;
}

.entry-card p {
  color: var(--app-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}
</style>
