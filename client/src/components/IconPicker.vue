<template>
  <div class="icon-picker">
    <!-- 已选图标预览（右上角关闭按钮清空） -->
    <div class="icon-picker__preview" :class="{ 'is-empty': !modelValue }">
      <SvgIcon v-if="modelValue" :name="modelValue" :size="20" />
      <el-icon v-else class="icon-picker__placeholder"><Picture /></el-icon>
      <el-icon
        v-if="modelValue && !disabled"
        class="icon-picker__remove"
        title="清除图标"
        @click.stop="clear"
      >
        <CircleCloseFilled />
      </el-icon>
    </div>

    <!-- 选择按钮 -->
    <el-button :disabled="disabled" @click="openDialog">
      <el-icon v-if="!modelValue"><Picture /></el-icon>
      <span>{{ modelValue ? '更换图标' : '选择图标' }}</span>
    </el-button>

    <!-- 图标选择弹窗（复用封装的 DraggableDialog） -->
    <DraggableDialog v-model="dialogVisible" title="选择图标" width="860px" top="10vh">
      <div class="icon-picker__dialog">
        <!-- 左侧分组列表 -->
        <div class="icon-picker__groups">
          <div
            class="icon-picker__group-item"
            :class="{ 'is-active': activeGroupId === null }"
            @click="selectGroup(null)"
          >
            <span class="icon-picker__group-name">全部</span>
            <span class="icon-picker__group-count">{{ options.length }}</span>
          </div>
          <div
            v-for="g in groups"
            :key="g.id"
            class="icon-picker__group-item"
            :class="{ 'is-active': activeGroupId === g.id }"
            @click="selectGroup(g.id)"
          >
            <span class="icon-picker__group-name">{{ g.name }}</span>
            <span class="icon-picker__group-count">{{ g.iconCount ?? 0 }}</span>
          </div>
        </div>

        <!-- 右侧图标区域 -->
        <div class="icon-picker__main">
          <el-input
            v-model="keyword"
            placeholder="搜索图标名称"
            :prefix-icon="Search"
            clearable
            class="icon-picker__search"
          />

          <!-- 加载中 -->
          <div v-if="loading" class="icon-picker__status">
            <el-icon class="is-loading" :size="24"><Loading /></el-icon>
            <span>加载中...</span>
          </div>

          <!-- 空状态 -->
          <div v-else-if="filteredOptions.length === 0" class="icon-picker__status">
            <el-empty description="暂无图标" :image-size="80" />
          </div>

          <!-- 图标网格 -->
          <div v-else class="icon-picker__grid">
            <div
              v-for="item in filteredOptions"
              :key="item.value"
              class="icon-picker__item"
              :class="{ 'is-active': item.value === modelValue }"
              :title="item.value"
              @click="select(item)"
            >
              <SvgIcon :name="item.value" :size="24" />
              <span class="icon-picker__item-name">{{ item.iconName }}</span>
            </div>
          </div>
        </div>
      </div>
    </DraggableDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Search, Picture, CircleCloseFilled, Loading } from '@element-plus/icons-vue'
import SvgIcon from '@/components/SvgIcon.vue'
import DraggableDialog from '@/components/DraggableDialog.vue'
import { getIconOptions, getIconGroups, type IconOption } from '@/utils/api'

interface Props {
  /** 图标引用值，格式：分组slug/图标名（如 object/history） */
  modelValue?: string
  /** 是否禁用（禁用后无法选择与清空） */
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// ─── 弹窗与数据状态 ─────────────────────────────────────
const dialogVisible = ref(false)
const loading = ref(false)
const options = ref<IconOption[]>([])
const groups = ref<any[]>([])
const keyword = ref('')
/** 当前选中的分组 ID，null 表示全部 */
const activeGroupId = ref<number | null>(null)

// 分组 + 名称关键字过滤（搜索仅匹配图标名称）
const filteredOptions = computed(() => {
  let list = options.value
  if (activeGroupId.value !== null) {
    list = list.filter((o) => o.groupId === activeGroupId.value)
  }
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter((o) => o.iconName.toLowerCase().includes(kw))
  }
  return list
})

/**
 * 打开弹窗：每次打开都重新拉取分组与图标选项，保证数据最新
 */
function openDialog() {
  dialogVisible.value = true
  loadData()
}

/**
 * 并行加载分组列表与图标选项（轻量接口，不含 SVG 源码）
 */
async function loadData() {
  loading.value = true
  try {
    const [groupRes, optionRes] = await Promise.all([getIconGroups(), getIconOptions()])
    groups.value = groupRes.data?.data || []
    options.value = optionRes.data?.data || []
  } catch {
    ElMessage.error('图标列表加载失败')
  } finally {
    loading.value = false
  }
}

/**
 * 切换分组：切换时清空搜索关键字，避免新分组被旧关键字过滤造成困惑
 */
function selectGroup(id: number | null) {
  activeGroupId.value = id
  keyword.value = ''
}

/**
 * 选中图标：回填引用值并关闭弹窗
 */
function select(item: IconOption) {
  emit('update:modelValue', item.value)
  dialogVisible.value = false
}

/**
 * 清除已选图标
 */
function clear() {
  emit('update:modelValue', '')
}

// 关闭弹窗时重置分组与搜索关键字，下次打开回到「全部」全量列表
watch(dialogVisible, (val) => {
  if (!val) {
    activeGroupId.value = null
    keyword.value = ''
  }
})
</script>

<style scoped lang="scss">
.icon-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

// 预览框：已选图标或占位图标
.icon-picker__preview {
  position: relative;
  width: 40px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);

  &.is-empty {
    color: var(--el-text-color-secondary);
  }
}

.icon-picker__placeholder {
  font-size: 18px;
}

// 右上角清除按钮
.icon-picker__remove {
  position: absolute;
  top: -6px;
  right: -6px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  border-radius: 50%;
  cursor: pointer;
  line-height: 1;
  z-index: 2;

  &:hover {
    color: var(--el-color-danger);
  }
}

// ─── 弹窗内容 ─────────────────────────────────────────
.icon-picker__dialog {
  display: flex;
  gap: 16px;
  height: 500px;
}

// 左侧分组
.icon-picker__groups {
  width: 160px;
  flex-shrink: 0;
  border-right: 1px solid var(--el-border-color-lighter);
  padding-right: 8px;
  overflow-y: auto;
}

.icon-picker__group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  margin-bottom: 2px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--el-text-color-regular);
  transition: all 0.2s;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.is-active {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    font-weight: 500;
  }
}

.icon-picker__group-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-picker__group-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

// 右侧区域
.icon-picker__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.icon-picker__search {
  margin-bottom: 12px;
  max-width: 280px;
  flex-shrink: 0;
}

.icon-picker__status {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
}

.icon-picker__grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  align-content: start;
  padding: 2px;
}

.icon-picker__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  cursor: pointer;
  color: var(--el-text-color-primary);
  transition: all 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-3);
  }

  &.is-active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}

.icon-picker__item-name {
  font-size: 12px;
  color: var(--el-text-color-regular);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
