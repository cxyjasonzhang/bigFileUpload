<template>
  <div class="icon-group-list">
    <!-- 全部 -->
    <div
      class="group-item"
      :class="{ active: activeGroupId === null }"
      @click="$emit('select', null)"
    >
      <span class="group-name">全部</span>
    </div>

    <!-- 分组列表：右键唤起悬浮框 -->
    <el-dropdown
      v-for="group in groups"
      :key="group.id"
      class="group-dropdown"
      trigger="contextmenu"
      placement="bottom-start"
      @command="(cmd) => handleCommand(cmd, group)"
    >
      <div
        class="group-item"
        :class="{ active: activeGroupId === group.id }"
        @click="$emit('select', group.id)"
      >
        <span class="group-name" :title="group.name">{{ group.name }}</span>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item :command="'edit'" :icon="Edit">编辑分组</el-dropdown-item>
          <el-dropdown-item :command="'delete'" :icon="Delete" divided>删除分组</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 新建分组 -->
    <div class="create-btn" @click="$emit('create', 'create')">
      <el-icon><Plus /></el-icon>
      <span>新建分组</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Edit, Delete, Plus } from '@element-plus/icons-vue'

const props = withDefaults(
  defineProps<{
    groups?: any[]
    activeGroupId?: number | null
  }>(),
  {
    groups: () => [],
    activeGroupId: null,
  },
)

const emit = defineEmits<{
  (e: 'select', id: number | null): void
  (e: 'edit', mode: string, group: any): void
  (e: 'delete', group: any): void
  (e: 'create', mode: string): void
}>()

/**
 * 右键悬浮框命令分发：编辑 / 删除
 */
function handleCommand(cmd, group) {
  if (cmd === 'edit') emit('edit', 'edit', group)
  else if (cmd === 'delete') emit('delete', group)
}
</script>

<style lang="scss" scoped>
.icon-group-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-dropdown {
  display: block;
}

.group-item {
  display: flex;
  align-items: center;
  padding: 9px 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--el-text-color-regular);
  border-left: 3px solid transparent;
  transition: background-color 0.18s ease, color 0.18s ease;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.active {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-weight: 500;
    border-left-color: var(--el-color-primary);
  }

  .group-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.create-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 12px;
  margin-top: 6px;
  cursor: pointer;
  color: var(--el-color-primary);
  font-size: 14px;
  border: 1px dashed var(--el-color-primary-light-5);
  border-radius: 8px;
  transition: background 0.2s;

  &:hover {
    background: var(--el-color-primary-light-9);
  }
}
</style>
