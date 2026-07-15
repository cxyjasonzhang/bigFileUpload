<template>
  <div class="icon-grid-container">
    <!-- 顶部操作栏 -->
    <div class="toolbar">
      <el-input
        v-model="searchText"
        placeholder="搜索图标名称..."
        :prefix-icon="Search"
        clearable
        class="search-input"
        @input="onSearch"
      />
      <el-button type="primary" :icon="Upload" @click="$emit('import')">
        导入图标
      </el-button>
    </div>

    <!-- 图标网格 -->
    <div v-if="!loading && icons.length > 0" class="icon-grid">
      <div v-for="icon of icons" :key="icon.id" class="icon-card" @click="handleCardClick(icon)">
        <!-- SVG 预览 -->
        <div class="icon-preview" v-html="icon.svgContent" />
        <!-- 名称 -->
        <div class="icon-name" :title="icon.name">{{ icon.name }}</div>
        <!-- 灰色半透明遮罩 -->
        <div class="icon-mask" />
        <!-- 悬浮操作（2×2 网格） -->
        <div class="icon-overlay">
          <el-button class="icon-action-btn" :icon="Edit" @click.stop="$emit('edit', 'edit', icon)" />
          <el-button class="icon-action-btn" :icon="Delete" @click.stop="$emit('delete', icon)" />
          <el-button class="icon-action-btn" :icon="CopyDocument" @click.stop="$emit('copy', icon)" />
          <el-button class="icon-action-btn" :icon="Download" @click.stop="$emit('download', icon)" />
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && icons.length === 0" class="empty-state">
      <el-empty description="暂无图标，点击上方「导入图标」按钮添加" />
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-state">
      <el-icon class="loading-icon" :size="32"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pagination">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next, total"
        background
        small
        @current-change="$emit('page-change', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Search, Upload, Edit, Delete, Loading, CopyDocument, Download } from '@element-plus/icons-vue'

const props = defineProps<{
  icons: any[]
  loading: boolean
  page: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{
  (e: 'search', val: string): void
  (e: 'page-change', val: number): void
  (e: 'import'): void
  (e: 'edit', mode: string, icon: any): void
  (e: 'delete', icon: any): void
  (e: 'copy', icon: any): void
  (e: 'download', icon: any): void
}>()

const searchText = ref('')
let searchTimer: any = null

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    emit('search', searchText.value)
  }, 300)
}

function handleCardClick(icon) {
  emit('edit', 'edit', icon)
}
</script>

<style lang="scss" scoped>
.icon-grid-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-shrink: 0;

  .search-input {
    width: 240px;
  }
}

.icon-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 12px;
  align-content: start;
}

.icon-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-3);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

    .icon-mask,
    .icon-overlay {
      opacity: 1;
    }
  }
}

.icon-preview {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
  // 图标浮于遮罩之上，悬浮时仍清晰可见
  position: relative;
  z-index: 2;

  :deep(svg) {
    max-width: 100%;
    max-height: 100%;
  }
}

.icon-name {
  font-size: 12px;
  color: var(--el-text-color-regular);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.icon-mask {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.icon-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 18px;
  align-content: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;

  .icon-action-btn {
    color: #fff;
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
    font-size: 26px;

    &:hover {
      background: transparent;
      color: #dedcdc;
    }

    // 重置 Element Plus 的 .el-button + .el-button { margin-left: 12px }
    & + .el-button {
      margin-left: 0;
    }

    :deep(.el-icon) {
      color: #fff;
      font-size: 26px;
    }
  }
}

.empty-state,
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.pagination {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
  flex-shrink: 0;
}
</style>
