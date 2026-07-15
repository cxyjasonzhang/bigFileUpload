<template>
  <div class="app-tabs">
    <el-tag
      v-for="tag in visitedRoutes"
      :key="tag.path"
      :closable="!tag.pinned"
      :effect="tag.path === route.path ? 'dark' : 'plain'"
      class="tab-tag"
      @click="handleClick(tag.path)"
      @close="handleClose(tag)"
    >
      {{ tag.title }}
    </el-tag>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { useLayoutStore, type VisitedRoute } from "@/stores/layout";

const route = useRoute();
const router = useRouter();
const layout = useLayoutStore();
const { visitedRoutes } = storeToRefs(layout);

function handleClick(path: string) {
  router.push(path);
}

// 关闭 Tab：从已访问列表移除；若关闭的是当前页，则回退到相邻/工作台
function handleClose(tag: VisitedRoute) {
  if (tag.pinned) return;
  const isActive = tag.path === route.path;
  const idx = layout.visitedRoutes.findIndex((v) => v.path === tag.path);
  layout.removeVisited(tag.path);

  if (isActive) {
    const remaining = layout.visitedRoutes;
    const neighbor =
      remaining[idx - 1] ||
      remaining[idx] ||
      remaining.find((v) => v.pinned) || { path: "/workbench" };
    router.push(neighbor.path);
  }
}
</script>

<style scoped>
.app-tabs {
  height: 40px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  overflow-x: auto;
}

.tab-tag {
  cursor: pointer;
  user-select: none;
}
</style>
