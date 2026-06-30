<template>
  <div class="upload-card">
    <!-- 文件选择区域 -->
    <el-upload
      ref="uploadRef"
      drag
      :auto-upload="false"
      :show-file-list="false"
      :on-change="handleFileChange"
    >
      <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
      <div class="el-upload__text">拖拽文件到此处，或 <em>点击选择文件</em></div>
      <template #tip>
        <div class="el-upload__tip">支持大文件上传，自动分片、断点续传</div>
      </template>
    </el-upload>

    <!-- 已选文件信息 -->
    <div v-if="file" class="file-info">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="文件名">{{ file.name }}</el-descriptions-item>
        <el-descriptions-item label="大小">{{ formatSize(file.size) }}</el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- Hash 计算进度 -->
    <div v-if="hashing" class="progress-section">
      <span class="progress-label">🔍 计算文件指纹中...</span>
      <el-progress :percentage="hashProgress" :stroke-width="10" status="success" />
    </div>

    <!-- 上传进度 -->
    <div v-if="uploading" class="progress-section">
      <span class="progress-label">📤 上传中...</span>
      <el-progress :percentage="uploadProgress" :stroke-width="14" :format="uploadProgressFormat" />
      <div class="upload-detail">
        已上传 {{ uploadedChunks }} / {{ totalChunks }} 个分片
      </div>
    </div>

    <!-- 上传中：暂停 -->
    <div class="action-bar" v-if="uploading && !paused">
      <el-button type="warning" @click="pauseUpload">
        ⏸️ 暂停上传
      </el-button>
    </div>

    <!-- 已暂停：继续 + 取消 -->
    <div class="action-bar" v-if="paused">
      <el-button type="primary" @click="continueUpload">
        ▶️ 继续上传
      </el-button>
      <el-button type="danger" @click="cancelUpload">
        ✕ 取消上传
      </el-button>
    </div>

    <!-- 未开始：开始上传 / 断点续传 -->
    <div class="action-bar" v-if="file && !uploading && !hashing && !uploadSuccess">
      <el-button type="primary" @click="startUpload" :disabled="!file">
        🚀 开始上传
      </el-button>
      <el-button v-if="hasUnfinishedUpload" type="warning" @click="resumeUpload">
        🔄 断点续传
      </el-button>
    </div>

    <!-- 上传结果 -->
    <el-result
      v-if="uploadSuccess"
      icon="success"
      title="上传成功！"
      :sub-title="file?.name"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { calculateFileHash, createFileChunks } from '../utils/file.js'
import { checkFile, uploadChunk, mergeChunks } from '../utils/api.js'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB

const file = ref(null)
const fileHash = ref('')
const hashing = ref(false)
const hashProgress = ref(0)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadedChunks = ref(0)
const totalChunks = ref(0)
const uploadSuccess = ref(false)
const paused = ref(false)
const hasUnfinishedUpload = ref(false)
const skipChunks = ref(new Set())
let abortController = null

const uploadRef = ref()

function handleFileChange(uploadFile) {
  file.value = uploadFile.raw
  uploadSuccess.value = false
  hasUnfinishedUpload.value = false
  hashProgress.value = 0
  uploadProgress.value = 0
  uploadedChunks.value = 0
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function uploadProgressFormat(percentage) {
  return `${percentage}%`
}

async function startUpload() {
  if (!file.value) return

  uploadSuccess.value = false
  uploading.value = true
  uploadedChunks.value = 0
  skipChunks.value = new Set()

  try {
    // 1. 计算文件 hash
    hashing.value = true
    hashProgress.value = 0
    fileHash.value = await calculateFileHash(file.value, (progress) => {
      hashProgress.value = progress
    })
    hashing.value = false

    // 2. 检查文件是否已上传（秒传）
    const { data: checkResult } = await checkFile(fileHash.value, file.value.name)
    if (checkResult.data.uploaded) {
      ElMessage.success('文件已存在，秒传成功！')
      uploadSuccess.value = true
      uploading.value = false
      uploadProgress.value = 100
      return
    }

    // 3. 记录已上传的分片（断点续传）
    const existingChunks = checkResult.data.uploadedChunks || []
    skipChunks.value = new Set(existingChunks)

    // 4. 创建分片并上传
    const chunks = createFileChunks(file.value, CHUNK_SIZE)
    totalChunks.value = chunks.length
    uploadedChunks.value = skipChunks.value.size
    uploadProgress.value = Math.round((uploadedChunks.value / totalChunks.value) * 100)

    await uploadChunks(chunks)

    // 5. 合并分片
    const { data: mergeResult } = await mergeChunks(
      fileHash.value,
      file.value.name,
      totalChunks.value
    )

    if (mergeResult.code === 0) {
      ElMessage.success('上传成功！')
      uploadSuccess.value = true
      uploadProgress.value = 100
    } else {
      ElMessage.error(mergeResult.msg || '合并失败')
    }
  } catch (err) {
    if (err.paused) {
      hasUnfinishedUpload.value = true
      return
    }
    console.error(err)
    ElMessage.error('上传失败：' + (err.message || '未知错误'))
    hasUnfinishedUpload.value = true
  } finally {
    uploading.value = false
    hashing.value = false
  }
}

async function resumeUpload() {
  if (!file.value || !fileHash.value) {
    ElMessage.warning('请重新选择文件后使用断点续传')
    return
  }

  uploading.value = true
  uploadSuccess.value = false

  try {
    // 检查已上传分片
    const { data: checkResult } = await checkFile(fileHash.value, file.value.name)
    if (checkResult.data.uploaded) {
      ElMessage.success('文件已存在，秒传成功！')
      uploadSuccess.value = true
      uploading.value = false
      uploadProgress.value = 100
      return
    }

    const existingChunks = checkResult.data.uploadedChunks || []
    skipChunks.value = new Set(existingChunks)

    const chunks = createFileChunks(file.value, CHUNK_SIZE)
    totalChunks.value = chunks.length
    uploadedChunks.value = skipChunks.value.size
    uploadProgress.value = Math.round((uploadedChunks.value / totalChunks.value) * 100)

    await uploadChunks(chunks)

    const { data: mergeResult } = await mergeChunks(
      fileHash.value,
      file.value.name,
      totalChunks.value
    )

    if (mergeResult.code === 0) {
      ElMessage.success('上传成功！')
      uploadSuccess.value = true
      uploadProgress.value = 100
    } else {
      ElMessage.error(mergeResult.msg || '合并失败')
    }
  } catch (err) {
    if (err.paused) {
      hasUnfinishedUpload.value = true
      return
    }
    console.error(err)
    ElMessage.error('续传失败：' + (err.message || '未知错误'))
  } finally {
    uploading.value = false
  }
}

async function uploadChunks(chunks) {
  const CONCURRENT_LIMIT = 3 // 并发上传数
  const tasks = chunks.filter(chunk => !skipChunks.value.has(chunk.index))

  abortController = new AbortController()
  let index = 0

  async function runNext() {
    while (index < tasks.length && !paused.value) {
      const currentIndex = index++
      const chunk = tasks[currentIndex]

      const formData = new FormData()
      formData.append('fileHash', fileHash.value)
      formData.append('chunkIndex', chunk.index)
      formData.append('file', chunk.file)

      try {
        await uploadChunk(formData, { signal: abortController.signal })
        uploadedChunks.value++
        uploadProgress.value = Math.round((uploadedChunks.value / totalChunks.value) * 100)
      } catch (err) {
        if (err.code === 'ERR_CANCELED') {
          // 被暂停信号取消，不视为错误
          return
        }
        throw err
      }
    }
  }

  // 并发控制
  const workers = []
  for (let i = 0; i < Math.min(CONCURRENT_LIMIT, tasks.length); i++) {
    workers.push(runNext())
  }

  await Promise.all(workers)

  // 如果是暂停状态，抛出特殊标记
  if (paused.value) {
    throw { paused: true }
  }
}

// 暂停上传
function pauseUpload() {
  paused.value = true
  if (abortController) {
    abortController.abort()
  }
}

// 继续上传（暂停后恢复）
async function continueUpload() {
  if (!file.value || !fileHash.value) {
    ElMessage.warning('请重新选择文件后重试')
    return
  }

  paused.value = false
  uploading.value = true
  uploadSuccess.value = false

  try {
    const { data: checkResult } = await checkFile(fileHash.value, file.value.name)
    if (checkResult.data.uploaded) {
      ElMessage.success('文件已存在，秒传成功！')
      uploadSuccess.value = true
      uploading.value = false
      uploadProgress.value = 100
      return
    }

    const existingChunks = checkResult.data.uploadedChunks || []
    skipChunks.value = new Set(existingChunks)

    const chunks = createFileChunks(file.value, CHUNK_SIZE)
    uploadedChunks.value = skipChunks.value.size
    uploadProgress.value = Math.round((uploadedChunks.value / totalChunks.value) * 100)

    await uploadChunks(chunks)

    const { data: mergeResult } = await mergeChunks(fileHash.value, file.value.name, totalChunks.value)
    if (mergeResult.code === 0) {
      ElMessage.success('上传成功！')
      uploadSuccess.value = true
      uploadProgress.value = 100
      hasUnfinishedUpload.value = false
    } else {
      ElMessage.error(mergeResult.msg || '合并失败')
    }
  } catch (err) {
    if (err.paused) {
      hasUnfinishedUpload.value = true
      return
    }
    console.error(err)
    ElMessage.error('上传失败：' + (err.message || '未知错误'))
    hasUnfinishedUpload.value = true
  } finally {
    uploading.value = false
  }
}

// 取消上传
function cancelUpload() {
  pauseUpload()
  file.value = null
  fileHash.value = ''
  hashProgress.value = 0
  uploadProgress.value = 0
  uploadedChunks.value = 0
  totalChunks.value = 0
  uploadSuccess.value = false
  hasUnfinishedUpload.value = false
  skipChunks.value = new Set()
  paused.value = false
}
</script>

<style scoped>
.upload-card {
  background: #fff;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.file-info {
  margin-top: 20px;
}

.progress-section {
  margin-top: 20px;
}

.progress-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.upload-detail {
  margin-top: 8px;
  font-size: 13px;
  color: #909399;
  text-align: center;
}

.action-bar {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
