<template>
  <div class="icon-group-list">
    <!-- 全部 -->
    <div
      class="group-item"
      :class="{ active: activeGroupId === null }"
      @click="$emit('select', null)"
    >
      <span class="group-name">全部</span>
      <el-badge :value="totalCount" :max="999" class="group-badge" />
    </div>

    <!-- 分组列表 -->
    <div
      v-for="group in groups"
      :key="group.id"
      class="group-item"
      :class="{ active: activeGroupId === group.id }"
      @click="$emit('select', group.id)"
    >
      <span class="group-name" :title="group.name">{{ group.name }}</span>
      <div class="group-actions">
        <el-badge :value="group.iconCount" :max="999" class="group-badge" />
        <span class="action-btns" @click.stop>
          <el-button link size="small" @click="$emit('edit', 'edit', group)">
            <el-icon><Edit /></el-icon>
          </el-button>
          <el-button link size="small" @click="$emit('delete', group)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </span>
      </div>
    </div>

    <!-- 新建分组 -->
    <div class="create-btn" @click="$emit('create', 'create')">
      <el-icon><Plus /></el-icon>
      <span>新建分组</span>
    </div>
  </div>
</template>

<script setup>
import { Edit, Delete, Plus } from '@element-plus/icons-vue'

defineProps({
  groups: { type: Array, default: () => [] },
  activeGroupId: { type: [Number, null], default: null },
  totalCount: { type: Number, default: 0 },
})

defineEmits(['select', 'edit', 'delete', 'create'])
</script>

<style lang="scss" scoped>
.icon-group-list {
  padding: 8px 0;
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-left: 3px solid transparent;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.active {
    background: var(--el-color-primary-light-9);
    border-left-color: var(--el-color-primary);
    color: var(--el-color-primary);
    font-weight: 500;
  }

  .group-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }

  .group-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;

    .action-btns {
      display: none;
    }
  }

  &:hover .group-actions .action-btns {
    display: inline-flex;
  }
}

.group-badge {
  flex-shrink: 0;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  margin: 8px 12px;
  cursor: pointer;
  color: var(--el-color-primary);
  font-size: 14px;
  border: 1px dashed var(--el-color-primary-light-5);
  border-radius: 6px;
  justify-content: center;
  transition: background 0.2s;

  &:hover {
    background: var(--el-color-primary-light-9);
  }
}
</style>
