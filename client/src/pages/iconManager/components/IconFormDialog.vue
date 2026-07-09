<template>
  <DraggableDialog
    v-model="visible"
    :title="isEdit ? '编辑图标' : '导入图标'"
    width="640px"
    :close-on-click-modal="false"
  >
    <!-- 编辑模式 -->
    <template v-if="isEdit">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="80px">
        <el-form-item label="所属分组" prop="groupId">
          <el-select v-model="editForm.groupId" placeholder="请选择分组">
            <el-option v-for="g of groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="图标名称" prop="name">
          <el-input v-model="editForm.name" placeholder="图标名称" maxlength="100" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" placeholder="可选" maxlength="255" />
        </el-form-item>
        <el-form-item label="SVG内容" prop="svgContent">
          <el-input
            v-model="editForm.svgContent"
            type="textarea"
            :rows="6"
            placeholder="<svg>...</svg>"
          />
        </el-form-item>
        <el-form-item label="预览">
          <div class="preview-row">
            <div class="preview-box" v-html="editForm.svgContent" />
            <div class="preview-actions">
              <el-button
                size="small"
                :type="isDesaturated ? 'warning' : 'default'"
                @click="handleDesaturate"
              >{{ isDesaturated ? '还原' : '去色' }}</el-button>
              <el-button
                size="small"
                :type="isTrimmed ? 'warning' : 'default'"
                @click="handleTrimMargin"
              >{{ isTrimmed ? '还原' : '去边距' }}</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
    </template>

    <!-- 导入模式 -->
    <template v-else>
      <el-form label-width="80px">
        <el-form-item label="所属分组">
          <el-select v-model="targetGroupId" placeholder="请选择分组">
            <el-option v-for="g of groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
      </el-form>

      <!-- 拖拽上传区域 -->
      <div
        class="drop-zone"
        :class="{ 'is-dragover': isDragover }"
        @dragover.prevent="isDragover = true"
        @dragleave="isDragover = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <el-icon class="drop-icon" :size="40"><UploadFilled /></el-icon>
        <p>拖拽 SVG 文件到此区域，或点击选择文件</p>
        <span class="drop-hint">支持 .svg 格式，单文件 &le; 100KB</span>
        <input
          ref="fileInputRef"
          type="file"
          accept=".svg"
          multiple
          style="display: none"
          @change="handleFileSelect"
        />
      </div>

      <!-- 已添加文件列表 -->
      <div v-if="fileList.length > 0" class="file-list">
        <div class="file-list-title">已添加文件（{{ fileList.length }}个）：</div>
        <div v-for="(file, index) of fileList" :key="index" class="file-item">
          <el-icon class="file-icon"><Document /></el-icon>
          <span
            class="file-name"
            contenteditable="true"
            @blur="updateIconName(index, $event)"
            @keydown.enter.prevent="$event.target.blur()"
          >{{ file.iconName }}</span>
          <span v-if="file.duplicate" class="duplicate-warn">
            <el-icon><WarningFilled /></el-icon> 已存在
          </span>
          <span v-else class="check-ok">
            <el-icon><CircleCheckFilled /></el-icon>
          </span>
          <el-button
            link
            size="small"
            class="file-delete"
            @click="removeFile(index)"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <span class="edit-hint">点击图标名称可修改</span>
      </div>

      <!-- 预览区域 -->
      <div v-if="previewSvg" class="preview-section">
        <div class="preview-title">预览：{{ previewName }}</div>
        <div class="preview-box" v-html="previewSvg" />
      </div>
    </template>

    <template #footer>
      <el-button @click="close">{{ isEdit ? '取消' : '取消' }}</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="!isEdit && fileList.length === 0"
        @click="handleConfirm"
      >
        {{ isEdit ? '保存' : `确认导入 (${fileList.length})` }}
      </el-button>
    </template>
  </DraggableDialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Document, WarningFilled, CircleCheckFilled, Close } from '@element-plus/icons-vue'
import DraggableDialog from '@/components/DraggableDialog.vue'
import { updateIcon, batchCreateIcons, getIconNames } from '@/utils/api'

const props = defineProps({
  isEdit: { type: Boolean, default: false },
  iconData: { type: Object, default: null },
  groups: { type: Array, default: () => [] },
  defaultGroupId: { type: Number, default: undefined },
})

const emit = defineEmits(['confirm'])

const visible = ref(false)
const fileInputRef = ref(null)
const editFormRef = ref(null)
const submitting = ref(false)
const isDragover = ref(false)
const targetGroupId = ref(props.defaultGroupId)

// 文件列表
const fileList = reactive([])
const previewSvg = ref('')
const previewName = ref('')

// 编辑表单
const editForm = reactive({
  groupId: null,
  name: '',
  description: '',
  svgContent: '',
})

const editRules = {
  groupId: [{ required: true, message: '请选择分组', trigger: 'change' }],
  name: [{ required: true, message: '请输入图标名称', trigger: 'blur' }],
  svgContent: [
    { required: true, message: '请输入SVG内容', trigger: 'blur' },
    { validator: (_rule, value, cb) => {
      if (value && !value.includes('<svg')) cb(new Error('SVG内容不合法'))
      else cb()
    }, trigger: 'blur' },
  ],
}

// 去色 / 去边距 状态
const isDesaturated = ref(false)
const isTrimmed = ref(false)
const desaturateSnapshot = ref(null)
const trimMarginSnapshot = ref(null)

// 打开弹窗时初始化数据
watch(visible, (val) => {
  if (val) {
    if (props.isEdit && props.iconData) {
      editForm.groupId = props.iconData.groupId
      editForm.name = props.iconData.name || ''
      editForm.description = props.iconData.description || ''
      editForm.svgContent = props.iconData.svgContent || ''
    } else {
      fileList.length = 0
      targetGroupId.value = props.defaultGroupId
      previewSvg.value = ''
    }
    // 重置去色/去边距状态
    isDesaturated.value = false
    isTrimmed.value = false
    desaturateSnapshot.value = null
    trimMarginSnapshot.value = null
  }
})

/**
 * 打开弹窗，初始化数据
 */
function open() {
  visible.value = true
}

function close() {
  visible.value = false
}

// ─── 文件导入 ─────────────────────────────────────────

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files)
  processFiles(files)
  e.target.value = ''
}

function handleDrop(e) {
  isDragover.value = false
  const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.svg'))
  processFiles(files)
}

async function processFiles(files) {
  if (!targetGroupId.value) {
    ElMessage.warning('请先选择所属分组')
    return
  }

  // 获取已有图标名用于重复检测
  let existNames = []
  try {
    const res = await getIconNames(targetGroupId.value)
    existNames = res.data?.data || []
  } catch { /* 忽略 */ }

  for (const file of files) {
    // 大小校验
    if (file.size > 100 * 1024) {
      ElMessage.warning(`文件 ${file.name} 超过 100KB 限制，已跳过`)
      continue
    }

    // 读取文件内容
    const content = await readFileAsText(file)
    if (!content.includes('<svg')) {
      ElMessage.warning(`文件 ${file.name} 不是有效的 SVG 文件，已跳过`)
      continue
    }

    // 文件名去掉 .svg 后缀作为图标名
    let iconName = file.name.replace(/\.svg$/i, '')
    // 处理重复名
    const baseName = iconName
    let counter = 1
    while (fileList.some(f => f.iconName === iconName)) {
      iconName = `${baseName}_${counter++}`
    }

    // 检测与数据库中已有图标的冲突
    const duplicate = existNames.includes(iconName)

    fileList.push({
      iconName,
      svgContent: content,
      duplicate,
      file,
    })

    // 更新预览
    if (fileList.length === 1) {
      previewSvg.value = content
      previewName.value = iconName
    }
  }

  if (files.length > 0) {
    ElMessage.success(`已添加 ${fileList.length} 个文件`)
  }
}

function readFileAsText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => resolve('')
    reader.readAsText(file)
  })
}

function updateIconName(index, e) {
  fileList[index].iconName = e.target.textContent.trim() || fileList[index].iconName
}

function removeFile(index) {
  fileList.splice(index, 1)
  if (fileList.length === 0) {
    previewSvg.value = ''
  }
}

function handlePreview(index) {
  previewSvg.value = fileList[index].svgContent
  previewName.value = fileList[index].iconName
}

// ─── SVG 处理工具 ─────────────────────────────────────

/**
 * 去色：移除 SVG 内所有 fill 和 stroke 属性
 */
function desaturateSvg(svgString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) return svgString

  svg.querySelectorAll('[fill]').forEach(el => el.removeAttribute('fill'))
  svg.querySelectorAll('[stroke]').forEach(el => el.removeAttribute('stroke'))

  return new XMLSerializer().serializeToString(svg)
}

/**
 * 去边距：重新计算 viewBox，紧密包裹内容
 */
function trimSvgMargin(svgString) {
  const temp = document.createElement('div')
  temp.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none'
  temp.innerHTML = svgString
  document.body.appendChild(temp)

  const svg = temp.querySelector('svg')
  if (!svg) { document.body.removeChild(temp); return svgString }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const child of svg.children) {
    try {
      const bbox = child.getBBox()
      minX = Math.min(minX, bbox.x)
      minY = Math.min(minY, bbox.y)
      maxX = Math.max(maxX, bbox.x + bbox.width)
      maxY = Math.max(maxY, bbox.y + bbox.height)
    } catch { /* 跳过不可测量元素 */ }
  }

  document.body.removeChild(temp)

  if (!isFinite(minX)) return svgString

  const pad = 1
  svg.setAttribute('viewBox', `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`)
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')

  return new XMLSerializer().serializeToString(svg)
}

/**
 * 去色 / 还原
 */
function handleDesaturate() {
  if (isDesaturated.value) {
    // 还原
    editForm.svgContent = desaturateSnapshot.value
    desaturateSnapshot.value = null
    isDesaturated.value = false
    ElMessage.success('已还原颜色')
  } else {
    // 去色
    desaturateSnapshot.value = editForm.svgContent
    editForm.svgContent = desaturateSvg(editForm.svgContent)
    isDesaturated.value = true
    ElMessage.success('已去除颜色')
  }
}

/**
 * 去边距 / 还原
 */
function handleTrimMargin() {
  if (isTrimmed.value) {
    // 还原
    editForm.svgContent = trimMarginSnapshot.value
    trimMarginSnapshot.value = null
    isTrimmed.value = false
    ElMessage.success('已还原边距')
  } else {
    // 去边距
    trimMarginSnapshot.value = editForm.svgContent
    editForm.svgContent = trimSvgMargin(editForm.svgContent)
    isTrimmed.value = true
    ElMessage.success('已裁剪边距')
  }
}

// ─── 提交 ─────────────────────────────────────────────

async function handleConfirm() {
  submitting.value = true
  try {
    if (props.isEdit) {
      // 编辑模式
      const valid = await editFormRef.value.validate().catch(() => false)
      if (!valid) { submitting.value = false; return }
      await updateIcon(props.iconData.id, { ...editForm })
      ElMessage.success('图标更新成功')
    } else {
      // 批量导入
      if (fileList.length === 0) { submitting.value = false; return }
      if (!targetGroupId.value) {
        ElMessage.warning('请选择所属分组')
        submitting.value = false
        return
      }
      await batchCreateIcons({
        groupId: targetGroupId.value,
        icons: fileList.map(f => ({
          name: f.iconName,
          description: '',
          svgContent: f.svgContent,
        })),
      })
      ElMessage.success(`成功导入 ${fileList.length} 个图标`)
    }
    emit('confirm')
  } catch (err) {
    const msg = err.response?.data?.msg || '操作失败'
    ElMessage.error(msg)
  } finally {
    submitting.value = false
  }
}

defineExpose({ open, close })
</script>

<style lang="scss" scoped>
.drop-zone {
  border: 2px dashed var(--el-border-color);
  border-radius: 8px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--el-text-color-secondary);

  &:hover,
  &.is-dragover {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }

  .drop-icon {
    margin-bottom: 8px;
  }

  .drop-hint {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }
}

.file-list {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.file-list-title {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  font-size: 13px;
  border-radius: 4px;

  &:hover {
    background: var(--el-fill-color);
  }

  .file-icon {
    flex-shrink: 0;
    color: var(--el-color-primary);
  }

  .file-name {
    flex: 1;
    padding: 2px 6px;
    border-radius: 4px;
    outline: none;
    min-width: 40px;

    &:focus {
      background: var(--el-color-primary-light-9);
      box-shadow: 0 0 0 1px var(--el-color-primary);
    }
  }

  .duplicate-warn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: var(--el-color-warning);
    font-size: 12px;
    flex-shrink: 0;
  }

  .check-ok {
    color: var(--el-color-success);
    flex-shrink: 0;
  }

  .file-delete {
    flex-shrink: 0;
    color: var(--el-text-color-placeholder);

    &:hover {
      color: var(--el-color-danger);
    }
  }
}

.edit-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
  display: block;
}

.preview-section {
  margin-top: 12px;

  .preview-title {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin-bottom: 8px;
  }
}

.preview-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.preview-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;

  // 覆盖 Element Plus 的 .el-button + .el-button { margin-left: 12px }
  .el-button + .el-button {
    margin-left: 0;
  }
}

.preview-box {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-blank);
  min-height: 80px;
  min-width: 80px;

  :deep(svg) {
    width: 80px;
    height: 80px;
    background: var(--el-fill-color-blank);
    box-shadow: var(--el-box-shadow-light);
  }
}
</style>
