/// <reference lib="webworker" />
import SparkMD5 from "spark-md5";

interface WorkerInput {
  file: File;
  chunkSize?: number;
}

type WorkerOutput =
  | { type: "progress"; progress: number }
  | { type: "done"; hash: string }
  | { type: "error"; error: unknown };

// Web Worker 全局上下文（DOM 与 WebWorker 的 lib 不能并存，这里做断言隔离）
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = function (e: MessageEvent<WorkerInput>) {
  const { file, chunkSize = 2 * 1024 * 1024 } = e.data;
  const chunks = Math.ceil(file.size / chunkSize);
  const spark = new SparkMD5.ArrayBuffer();
  const reader = new FileReader();
  let currentChunk = 0;

  reader.onload = (event: ProgressEvent<FileReader>) => {
    const result = event.target?.result as ArrayBuffer | null;
    if (!result) return;
    spark.append(result);
    currentChunk++;
    ctx.postMessage({
      type: "progress",
      progress: Math.round((currentChunk / chunks) * 100),
    } as WorkerOutput);

    if (currentChunk < chunks) {
      loadNext();
    } else {
      ctx.postMessage({ type: "done", hash: spark.end() } as WorkerOutput);
    }
  };

  reader.onerror = () => {
    ctx.postMessage({ type: "error", error: reader.error } as WorkerOutput);
  };

  function loadNext() {
    const start = currentChunk * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    reader.readAsArrayBuffer(file.slice(start, end));
  }

  loadNext();
};
