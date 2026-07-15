// uploadQueue.ts - 大文件分片上传队列（排队、断点续传、并发限制、重试）
import { reactive } from "vue";
import { ElMessage } from "element-plus";
import {
  calculateFileHash,
  createFileChunks,
  type FileChunk,
} from "./file";
import {
  checkFile,
  uploadChunk,
  mergeChunks,
  type CheckFileResult,
} from "./api";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const CONCURRENT_LIMIT = 3;
const MAX_RETRIES = 3;
const STORAGE_KEY = "bigfile-upload-tasks";

export const TASK_STATUS = {
  PENDING: "pending",
  HASHING: "hashing",
  UPLOADING: "uploading",
  PAUSED: "paused",
  SUCCESS: "success",
  ERROR: "error",
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export interface UploadTask {
  id: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number;
  hashProgress: number;
  uploadProgress: number;
  status: TaskStatus;
  createTime: number;
}

/** 暂停专用错误（区别于真实失败） */
export class PausedError extends Error {
  paused = true;
  constructor() {
    super("paused");
    this.name = "PausedError";
  }
}

export class UploadQueue {
  tasks: UploadTask[];
  currentTaskId: string | null;
  fileMap: Map<string, File>;
  abortControllerMap: Map<string, AbortController>;

  constructor() {
    this.tasks = reactive<UploadTask[]>([]);
    this.currentTaskId = null;
    // 存储 File 对象的映射（File 不可序列化，单独保存在内存中）
    this.fileMap = new Map();
    // 存储每个任务的 AbortController
    this.abortControllerMap = new Map();
  }

  addTask(file: File): UploadTask {
    const task: UploadTask = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      fileName: file.name,
      fileSize: file.size,
      fileHash: "",
      chunkSize: CHUNK_SIZE,
      totalChunks: Math.ceil(file.size / CHUNK_SIZE),
      uploadedChunks: 0,
      hashProgress: 0,
      uploadProgress: 0,
      status: TASK_STATUS.PENDING,
      createTime: Date.now(),
    };
    this.tasks.push(task);
    this.fileMap.set(task.id, file);
    this.saveTasks();
    return task;
  }

  removeTask(taskId: string): void {
    const idx = this.tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      this.tasks.splice(idx, 1);
      this.fileMap.delete(taskId);
      this.abortControllerMap.delete(taskId);
      this.saveTasks();
    }
  }

  updateTask(taskId: string, updates: Partial<UploadTask>): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      Object.assign(task, updates);
      this.saveTasks();
    }
  }

  getTask(taskId: string): UploadTask | undefined {
    return this.tasks.find((t) => t.id === taskId);
  }

  matchTaskByHash(fileHash: string): UploadTask | undefined {
    return this.tasks.find(
      (t) => t.fileHash === fileHash && t.status !== TASK_STATUS.SUCCESS,
    );
  }

  saveTasks(): void {
    const serializable = this.tasks.map((t) => ({ ...t }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (e) {
      console.warn("保存任务到 localStorage 失败", e);
    }
  }

  loadTasks(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as UploadTask[];
      this.tasks.splice(0, this.tasks.length);
      parsed.forEach((t) => {
        // 刷新后，将 uploading/hashing 状态重置为 paused
        if (
          t.status === TASK_STATUS.UPLOADING ||
          t.status === TASK_STATUS.HASHING
        ) {
          t.status = TASK_STATUS.PAUSED;
        }
        this.tasks.push(t);
      });
    } catch (e) {
      console.warn("从 localStorage 恢复任务失败", e);
    }
  }

  async syncTaskWithServer(taskId: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task || !task.fileHash) return;

    try {
      const { data: checkResult } = await checkFile(
        task.fileHash,
        task.fileName,
      );
      const result = checkResult.data as CheckFileResult;
      if (result.uploaded) {
        this.updateTask(taskId, {
          status: TASK_STATUS.SUCCESS,
          uploadProgress: 100,
          uploadedChunks: task.totalChunks,
        });
      } else {
        const existingChunks = result.uploadedChunks || [];
        const uploadedCount = existingChunks.length;
        this.updateTask(taskId, {
          uploadedChunks: uploadedCount,
          uploadProgress: Math.round((uploadedCount / task.totalChunks) * 100),
          status: TASK_STATUS.PAUSED,
        });
      }
    } catch (e) {
      console.warn(`同步任务 ${taskId} 状态失败`, e);
    }
  }

  async startTask(taskId: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) return;
    const file = this.fileMap.get(taskId);
    if (!file) return;

    // 如果当前有任务在上传，不能启动新任务
    if (this.currentTaskId && this.currentTaskId !== taskId) {
      ElMessage.warning("当前有任务在上传，请等待上传完成后再试");
      return;
    }

    try {
      // 1. 计算 hash（如果还没有）
      if (!task.fileHash) {
        this.updateTask(taskId, {
          status: TASK_STATUS.HASHING,
          hashProgress: 0,
        });
        this.currentTaskId = taskId;

        const hash = await calculateFileHash(file, (progress) => {
          this.updateTask(taskId, { hashProgress: progress });
        });

        this.updateTask(taskId, { fileHash: hash });

        // 暂停检查：hash 计算期间可能已被暂停
        if (this.getTask(taskId)?.status === TASK_STATUS.PAUSED) return;

        // 检查 hash 是否与已有任务重复
        const duplicate = this.tasks.find(
          (t) =>
            t.id !== taskId &&
            t.fileHash === hash &&
            t.status !== TASK_STATUS.ERROR,
        );
        if (duplicate) {
          this.removeTask(taskId);
          this.currentTaskId = null;
          throw new Error(
            `文件 "${task.fileName}" 与 "${duplicate.fileName}" 重复`,
          );
        }
      }

      // 2. 检查文件是否已上传（秒传）
      const { data: checkResult } = await checkFile(
        task.fileHash,
        task.fileName,
      );

      // 暂停检查：checkFile 期间可能已被暂停
      if (this.getTask(taskId)?.status === TASK_STATUS.PAUSED) return;

      if ((checkResult.data as CheckFileResult).uploaded) {
        this.updateTask(taskId, {
          status: TASK_STATUS.SUCCESS,
          uploadProgress: 100,
          uploadedChunks: task.totalChunks,
        });
        this.currentTaskId = null;
        this.startNext();
        return;
      }

      // 3. 记录已上传分片
      const existingChunks =
        (checkResult.data as CheckFileResult).uploadedChunks || [];
      const skipChunks = new Set(existingChunks);

      // 4. 上传分片
      this.updateTask(taskId, {
        status: TASK_STATUS.UPLOADING,
        uploadedChunks: existingChunks.length,
        uploadProgress: Math.round(
          (existingChunks.length / task.totalChunks) * 100,
        ),
      });
      this.currentTaskId = taskId;

      const chunks = createFileChunks(file, CHUNK_SIZE);
      await this._uploadChunks(taskId, chunks, skipChunks);

      // 暂停检查：上传完成后可能已被暂停
      if (this.getTask(taskId)?.status === TASK_STATUS.PAUSED) return;

      // 5. 合并分片
      const { data: mergeResult } = await mergeChunks(
        task.fileHash,
        task.fileName,
        task.totalChunks,
      );

      if ((mergeResult.data as { code: number }).code === 0) {
        this.updateTask(taskId, {
          status: TASK_STATUS.SUCCESS,
          uploadProgress: 100,
        });
      } else {
        this.updateTask(taskId, { status: TASK_STATUS.ERROR });
      }
    } catch (err) {
      if (err instanceof PausedError) return;
      console.error("上传失败", err);
      this.updateTask(taskId, { status: TASK_STATUS.ERROR });
    } finally {
      if (this.currentTaskId === taskId) {
        this.currentTaskId = null;
      }
      this.startNext();
    }
  }

  private async _uploadChunks(
    taskId: string,
    chunks: FileChunk[],
    skipChunks: Set<number>,
  ): Promise<void> {
    const tasks = chunks.filter((chunk) => !skipChunks.has(chunk.index));
    const task = this.getTask(taskId);
    if (!task) return;

    const abortController = new AbortController();
    this.abortControllerMap.set(taskId, abortController);

    let index = 0;
    let isPaused = false;

    const runNext = async (): Promise<void> => {
      while (index < tasks.length) {
        // 检查是否暂停
        const currentTask = this.getTask(taskId);
        if (!currentTask || currentTask.status === TASK_STATUS.PAUSED) {
          isPaused = true;
          return;
        }

        const currentIndex = index++;
        const chunk = tasks[currentIndex];

        const formData = new FormData();
        formData.append("fileHash", task.fileHash);
        formData.append("chunkIndex", String(chunk.index));
        formData.append("file", chunk.file);

        let retryCount = 0;
        let uploadSuccess = false;
        while (retryCount < MAX_RETRIES && !uploadSuccess) {
          // 每次重试前检查暂停状态
          const t = this.getTask(taskId);
          if (!t || t.status === TASK_STATUS.PAUSED) {
            isPaused = true;
            return;
          }
          try {
            await uploadChunk(formData, { signal: abortController.signal });
            uploadSuccess = true;
            const curTask = this.getTask(taskId);
            if (curTask && curTask.status !== TASK_STATUS.PAUSED) {
              const newUploaded = curTask.uploadedChunks + 1;
              this.updateTask(taskId, {
                uploadedChunks: newUploaded,
                uploadProgress: Math.round(
                  (newUploaded / curTask.totalChunks) * 100,
                ),
              });
            }
          } catch (err) {
            const e = err as { code?: string; name?: string };
            if (
              e.code === "ERR_CANCELED" ||
              e.name === "CanceledError" ||
              e.name === "AbortError"
            ) {
              isPaused = true;
              return;
            }
            retryCount++;
            if (retryCount >= MAX_RETRIES) {
              throw new Error(
                `分片 ${chunk.index} 上传失败，已重试 ${MAX_RETRIES} 次`,
              );
            }
            // 指数退避延迟：第1次重试等1s，第2次等2s
            await new Promise((r) => setTimeout(r, 1000 * 2 ** (retryCount - 1)));
          }
        }
      }
    };

    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(CONCURRENT_LIMIT, tasks.length); i++) {
      workers.push(runNext());
    }
    await Promise.all(workers);

    if (isPaused) {
      throw new PausedError();
    }
  }

  pauseTask(taskId: string): void {
    const task = this.getTask(taskId);
    if (!task) return;
    if (
      task.status === TASK_STATUS.UPLOADING ||
      task.status === TASK_STATUS.HASHING
    ) {
      const ac = this.abortControllerMap.get(taskId);
      if (ac) ac.abort();
      this.updateTask(taskId, { status: TASK_STATUS.PAUSED });
    }
  }

  async resumeTask(taskId: string, file?: File): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) return;

    // 恢复前先将状态改为 PENDING，避免 startTask 中的暂停检查误判
    this.updateTask(taskId, { status: TASK_STATUS.PENDING });

    // 如果提供了文件，更新 fileMap
    if (file) {
      this.fileMap.set(taskId, file);
      // 如果任务还没有 hash 或文件信息变了，重新计算
      if (
        !task.fileHash ||
        task.fileName !== file.name ||
        task.fileSize !== file.size
      ) {
        this.updateTask(taskId, {
          fileHash: "",
          hashProgress: 0,
          fileName: file.name,
          fileSize: file.size,
          totalChunks: Math.ceil(file.size / CHUNK_SIZE),
        });
      }
    }

    // 如果没有 File 对象，无法恢复
    if (!this.fileMap.has(taskId)) {
      throw new Error("NO_FILE");
    }

    // 如果当前有其他任务在上传，不能恢复
    if (this.currentTaskId && this.currentTaskId !== taskId) {
      return;
    }

    this.startTask(taskId);
  }

  cancelTask(taskId: string): void {
    this.pauseTask(taskId);
    this.removeTask(taskId);
  }

  startNext(): void {
    if (this.currentTaskId) return;

    const nextTask = this.tasks.find(
      (t) => t.status === TASK_STATUS.PENDING && this.fileMap.has(t.id),
    );
    if (nextTask) {
      this.startTask(nextTask.id);
    }
  }

  hasFile(taskId: string): boolean {
    return this.fileMap.has(taskId);
  }

  setFile(taskId: string, file: File): void {
    this.fileMap.set(taskId, file);
  }
}
