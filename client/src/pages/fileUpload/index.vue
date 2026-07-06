<template>
  <div class="upload-card">
    <!-- 文件选择区域 -->
    <el-upload
      ref="uploadRef"
      drag
      multiple
      :auto-upload="false"
      :show-file-list="false"
      :on-change="handleFileChange"
    >
      <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
      <div class="el-upload__text">
        拖拽文件到此处，或 <em>点击选择文件</em>
      </div>
      <template #tip>
        <div class="el-upload__tip">
          支持多文件同时添加，自动排队上传、断点续传
        </div>
      </template>
    </el-upload>

    <!-- 恢复文件选择（隐藏的 input） -->
    <input
      ref="resumeFileInput"
      type="file"
      style="display: none"
      @change="handleResumeFileChange"
    />

    <!-- 任务列表 -->
    <div v-if="queue.tasks.length > 0" class="task-list">
      <div class="task-list-header">
        <span>上传任务列表</span>
        <el-button
          v-if="hasSuccessTasks"
          type="danger"
          size="small"
          text
          @click="clearSuccessTasks"
        >
          清除已完成
        </el-button>
      </div>

      <div
        v-for="task in queue.tasks"
        :key="task.id"
        class="task-item"
        :class="{ 'task-item--success': task.status === TASK_STATUS.SUCCESS }"
      >
        <div class="task-header">
          <div class="task-info">
            <span
              class="task-name"
              :class="{
                'task-name--done': task.status === TASK_STATUS.SUCCESS,
              }"
            >
              {{ task.fileName }}
            </span>
            <span class="task-size">{{ formatSize(task.fileSize) }}</span>
          </div>
          <el-tag :type="statusTagType(task.status)" size="small" effect="dark">
            {{ statusLabel(task.status) }}
          </el-tag>
        </div>

        <!-- Hash 计算进度 -->
        <div v-if="task.status === TASK_STATUS.HASHING" class="task-progress">
          <el-progress
            :percentage="task.hashProgress"
            :stroke-width="6"
            status="success"
            :show-text="false"
          />
          <span class="task-progress-text"
            >计算文件指纹 {{ task.hashProgress }}%</span
          >
        </div>

        <!-- 上传进度 -->
        <div v-if="isProgressVisible(task)" class="task-progress">
          <el-progress
            :percentage="task.uploadProgress"
            :stroke-width="8"
            :color="task.status === TASK_STATUS.PAUSED ? '#E6A23C' : '#409EFF'"
          />
          <span class="task-progress-text">
            {{ task.uploadedChunks }} / {{ task.totalChunks }} 分片
          </span>
        </div>

        <!-- 操作按钮 -->
        <div class="task-actions">
          <!-- 排队中 -->
          <template v-if="task.status === TASK_STATUS.PENDING">
            <el-button
              v-if="queue.hasFile(task.id)"
              type="primary"
              size="small"
              @click="queue.startTask(task.id)"
            >
              开始
            </el-button>
            <el-button
              type="danger"
              size="small"
              text
              @click="queue.removeTask(task.id)"
            >
              移除
            </el-button>
          </template>

          <!-- 上传中 -->
          <template v-if="task.status === TASK_STATUS.UPLOADING">
            <el-button
              type="warning"
              size="small"
              @click="handlePause(task.id)"
            >
              暂停
            </el-button>
          </template>

          <!-- 已暂停 -->
          <template v-if="task.status === TASK_STATUS.PAUSED">
            <el-button
              type="primary"
              size="small"
              @click="handleResume(task.id)"
            >
              继续
            </el-button>
            <el-button
              type="danger"
              size="small"
              text
              @click="queue.cancelTask(task.id)"
            >
              取消
            </el-button>
          </template>

          <!-- 上传失败 -->
          <template v-if="task.status === TASK_STATUS.ERROR">
            <el-button
              v-if="queue.hasFile(task.id)"
              type="warning"
              size="small"
              @click="handleRetry(task.id)"
            >
              重试
            </el-button>
            <el-button
              v-else
              type="warning"
              size="small"
              @click="handleSelectFileForResume(task.id)"
            >
              选择文件重试
            </el-button>
            <el-button
              type="danger"
              size="small"
              text
              @click="queue.removeTask(task.id)"
            >
              移除
            </el-button>
          </template>

          <!-- 上传成功 -->
          <template v-if="task.status === TASK_STATUS.SUCCESS">
            <el-button
              type="danger"
              size="small"
              text
              @click="queue.removeTask(task.id)"
            >
              移除
            </el-button>
          </template>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <el-empty description="暂无上传任务" :image-size="80" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { UploadFilled } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { UploadQueue, TASK_STATUS } from "@/utils/uploadQueue.js";

const queue = new UploadQueue();
const uploadRef = ref();
const resumeFileInput = ref();
const pendingResumeTaskId = ref(null);

const hasSuccessTasks = computed(() =>
  queue.tasks.some((t) => t.status === TASK_STATUS.SUCCESS),
);

function handleFileChange(uploadFile) {
  const task = queue.addTask(uploadFile.raw);
  if (!queue.currentTaskId) {
    queue.startTask(task.id);
  }
  uploadRef.value?.clearFiles();
}

function handlePause(taskId) {
  queue.pauseTask(taskId);
}

function handleResume(taskId) {
  if (queue.hasFile(taskId)) {
    queue.resumeTask(taskId);
  } else {
    handleSelectFileForResume(taskId);
  }
}

function handleRetry(taskId) {
  if (queue.hasFile(taskId)) {
    queue.updateTask(taskId, { status: TASK_STATUS.PENDING });
    if (!queue.currentTaskId) {
      queue.startTask(taskId);
    }
  } else {
    handleSelectFileForResume(taskId);
  }
}

function handleSelectFileForResume(taskId) {
  pendingResumeTaskId.value = taskId;
  resumeFileInput.value?.click();
}

function handleResumeFileChange(e) {
  const file = e.target.files?.[0];
  if (!file || !pendingResumeTaskId.value) return;

  const taskId = pendingResumeTaskId.value;
  pendingResumeTaskId.value = null;

  try {
    queue.resumeTask(taskId, file);
    ElMessage.success("文件已选择，开始恢复上传");
  } catch (err) {
    if (err.message === "NO_FILE") {
      ElMessage.error("文件选择失败，请重试");
    }
  }

  e.target.value = "";
}

function clearSuccessTasks() {
  const successIds = queue.tasks
    .filter((t) => t.status === TASK_STATUS.SUCCESS)
    .map((t) => t.id);
  successIds.forEach((id) => queue.removeTask(id));
}

function isProgressVisible(task) {
  return (
    [TASK_STATUS.UPLOADING, TASK_STATUS.PAUSED, TASK_STATUS.ERROR].includes(
      task.status,
    ) && task.totalChunks > 0
  );
}

function statusLabel(status) {
  const map = {
    [TASK_STATUS.PENDING]: "排队中",
    [TASK_STATUS.HASHING]: "计算中",
    [TASK_STATUS.UPLOADING]: "上传中",
    [TASK_STATUS.PAUSED]: "已暂停",
    [TASK_STATUS.SUCCESS]: "已完成",
    [TASK_STATUS.ERROR]: "失败",
  };
  return map[status] || status;
}

function statusTagType(status) {
  const map = {
    [TASK_STATUS.PENDING]: "info",
    [TASK_STATUS.HASHING]: "warning",
    [TASK_STATUS.UPLOADING]: "",
    [TASK_STATUS.PAUSED]: "warning",
    [TASK_STATUS.SUCCESS]: "success",
    [TASK_STATUS.ERROR]: "danger",
  };
  return map[status] || "info";
}

function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

onMounted(async () => {
  queue.loadTasks();

  const unfinishedTasks = queue.tasks.filter(
    (t) => t.status !== TASK_STATUS.SUCCESS && t.fileHash,
  );
  for (const task of unfinishedTasks) {
    await queue.syncTaskWithServer(task.id);
  }

  const staleTasks = queue.tasks.filter(
    (t) => !t.fileHash && !queue.hasFile(t.id),
  );
  staleTasks.forEach((t) => queue.removeTask(t.id));
});
</script>

<style lang="scss" scoped>
@use "./index.scss";
</style>
