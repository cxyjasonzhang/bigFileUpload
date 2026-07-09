<template>
  <div class="icon-manager">
    <!-- 左侧分组列表 -->
    <div class="sidebar">
      <IconGroupList
        :groups="groups"
        :active-group-id="activeGroupId"
        @select="handleGroupSelect"
        @edit="openGroupDialog"
        @delete="handleDeleteGroup"
        @create="openGroupDialog"
      />
    </div>

    <!-- 右侧图标区域 -->
    <div class="main">
      <IconGrid
        :icons="icons"
        :loading="loading"
        :page="page"
        :page-size="pageSize"
        :total="total"
        @search="handleSearch"
        @page-change="handlePageChange"
        @import="openIconDialog"
        @edit="openIconDialog"
        @delete="handleDeleteIcon"
        @copy="handleCopyIcon"
        @download="handleDownloadIcon"
      />
    </div>

    <!-- 分组编辑弹窗 -->
    <GroupFormDialog
      ref="groupDialogRef"
      :is-edit="groupDialogMode === 'edit'"
      @confirm="handleGroupConfirm"
    />

    <!-- 图标导入/编辑弹窗 -->
    <IconFormDialog
      ref="iconDialogRef"
      :is-edit="iconDialogMode === 'edit'"
      :icon-data="currentIcon"
      :groups="groups"
      :default-group-id="activeGroupId !== null ? activeGroupId : undefined"
      @confirm="handleIconConfirm"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getIconGroups, createIconGroup, updateIconGroup, deleteIconGroup,
  getIcons, deleteIcon, batchDeleteIcons,
} from '@/utils/api'
import { invalidate, invalidateAll, refreshVersion } from '@/utils/iconCache'
import IconGroupList from './components/IconGroupList.vue'
import IconGrid from './components/IconGrid.vue'
import GroupFormDialog from './components/GroupFormDialog.vue'
import IconFormDialog from './components/IconFormDialog.vue'

// ─── 状态 ────────────────────────────────────────────
const groups = ref([])
const icons = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(24)
const total = ref(0)
const activeGroupId = ref(null)
const keyword = ref('')

// 弹窗状态
const groupDialogRef = ref(null)
const groupDialogMode = ref('create')
const currentGroup = ref(null)

const iconDialogRef = ref(null)
const iconDialogMode = ref('create')
const currentIcon = ref(null)

// ─── 数据加载 ─────────────────────────────────────────

// 加载分组列表
async function loadGroups() {
  try {
    const res = await getIconGroups()
    groups.value = res.data?.data || []
  } catch {
    ElMessage.error('加载分组列表失败')
  }
}

// 加载图标列表
async function loadIcons() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (activeGroupId.value !== null) {
      params.groupId = activeGroupId.value
    }
    if (keyword.value) {
      params.keyword = keyword.value
    }
    const res = await getIcons(params)
    icons.value = res.data?.data?.list || []
    total.value = res.data?.data?.total || 0
  } catch {
    ElMessage.error('加载图标列表失败')
  } finally {
    loading.value = false
  }
}

// ─── 分组操作 ─────────────────────────────────────────

function handleGroupSelect(groupId) {
  activeGroupId.value = groupId
  page.value = 1
  loadIcons()
}

function openGroupDialog(mode, group) {
  groupDialogMode.value = mode
  currentGroup.value = group || null
  groupDialogRef.value?.open(mode === 'edit' ? group : null)
}

async function handleGroupConfirm(data) {
  try {
    if (groupDialogMode.value === 'create') {
      await createIconGroup(data)
      ElMessage.success('分组创建成功')
    } else {
      await updateIconGroup(currentGroup.value.id, data)
      ElMessage.success('分组更新成功')
    }
    groupDialogRef.value?.close()
    await loadGroups()
  } catch (err) {
    const msg = err.response?.data?.msg || '操作失败'
    ElMessage.error(msg)
  }
}

async function handleDeleteGroup(group) {
  try {
    await ElMessageBox.confirm(
      `确定要删除分组「${group.name}」及其下所有图标吗？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteIconGroup(group.id)
    ElMessage.success('分组已删除')
    if (activeGroupId.value === group.id) {
      activeGroupId.value = null
    }
    await loadGroups()
    await loadIcons()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.msg || '删除失败')
    }
  }
}

// ─── 图标操作 ─────────────────────────────────────────

function handleSearch(val) {
  keyword.value = val
  page.value = 1
  loadIcons()
}

function handlePageChange(p) {
  page.value = p
  loadIcons()
}

function openIconDialog(mode, icon) {
  iconDialogMode.value = mode
  currentIcon.value = icon || null
  iconDialogRef.value?.open()
}

async function handleIconConfirm() {
  // 数据已在子组件中提交，只需刷新列表
  iconDialogRef.value?.close()
  await loadIcons()
  await loadGroups()
  // 失效本地图标缓存：
  //   编辑 → 仅失效原图标（拿得到 groupSlug/name）
  //   新增 → 拿不到新图标名，整库失效后由网络重新拉取
  if (iconDialogMode.value === 'edit' && currentIcon.value?.groupSlug) {
    await invalidate(`${currentIcon.value.groupSlug}/${currentIcon.value.name}`)
  } else {
    await invalidateAll()
  }
  await refreshVersion()
}

async function handleDeleteIcon(icon) {
  try {
    await ElMessageBox.confirm(
      `确定要删除图标「${icon.name}」吗？`,
      '删除确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteIcon(icon.id)
    ElMessage.success('图标已删除')
    await invalidate(`${icon.groupSlug}/${icon.name}`)
    await refreshVersion()
    await loadIcons()
    await loadGroups()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.msg || '删除失败')
    }
  }
}

/**
 * 复制：将 <SvgIcon name="slug/iconName" /> 组件用法复制到剪贴板
 */
async function handleCopyIcon(icon) {
  const snippet = `<SvgIcon name="${icon.groupSlug}/${icon.name}" />`
  try {
    await copyText(snippet)
    ElMessage.success('已复制组件用法')
  } catch {
    ElMessage.error('复制失败，请检查浏览器剪贴板权限')
  }
}

/**
 * 下载：将 svgContent 作为 .svg 文件下载
 */
function handleDownloadIcon(icon) {
  const blob = new Blob([icon.svgContent], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${icon.name}.svg`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已下载 SVG 文件')
}

/**
 * 复制文本到剪贴板，优先使用 clipboard API，非安全上下文降级到 execCommand
 */
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) throw new Error('copy failed')
}

// ─── 初始化 ───────────────────────────────────────────
onMounted(() => {
  loadGroups()
  loadIcons()
})
</script>

<style lang="scss" scoped>
.icon-manager {
  display: flex;
  height: 100%;
  min-height: 500px;
  background: var(--el-bg-color);
}

.sidebar {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--el-border-color-light);
  overflow-y: auto;
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
