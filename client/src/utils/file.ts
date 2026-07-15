// file.ts - 文件 hash 计算与分片切割工具

export interface FileChunk {
  index: number;
  file: Blob;
}

export type HashProgressCallback = (progress: number) => void;

/**
 * 计算文件 hash（使用 Web Worker，不阻塞主线程）
 * @param file 文件对象
 * @param onProgress 进度回调 (0~100)
 * @returns 文件 hash
 */
export function calculateFileHash(
  file: File,
  onProgress?: HashProgressCallback,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(
      new URL("./hash.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (e: MessageEvent) => {
      const { type, progress, hash, error } = e.data as {
        type: string;
        progress?: number;
        hash?: string;
        error?: unknown;
      };
      if (type === "progress" && onProgress) {
        onProgress(progress ?? 0);
      } else if (type === "done" && hash) {
        worker.terminate();
        resolve(hash);
      } else if (type === "error") {
        worker.terminate();
        reject(error);
      }
    };

    worker.onerror = (err: ErrorEvent) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage({ file, chunkSize: 2 * 1024 * 1024 });
  });
}

/**
 * 将文件切割为分片
 * @param file 文件对象
 * @param chunkSize 分片大小（默认 5MB）
 * @returns 分片数组
 */
export function createFileChunks(
  file: File,
  chunkSize: number = 5 * 1024 * 1024,
): FileChunk[] {
  const chunks: FileChunk[] = [];
  const totalChunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    chunks.push({
      index: i,
      file: file.slice(start, end),
    });
  }

  return chunks;
}
