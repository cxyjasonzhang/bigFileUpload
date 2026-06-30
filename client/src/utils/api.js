import axios from "axios";

const BASE_URL = "/api";

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

/**
 * 检查文件是否已上传
 */
export function checkFile(fileHash, fileName) {
  return request.get("/check-file", {
    params: { fileHash, fileName },
  });
}

/**
 * 上传分片
 * @param {FormData} formData
 * @param {Object} options - { signal, onProgress }
 */
export function uploadChunk(formData, { signal, onProgress } = {}) {
  return request.post("/upload-chunk", formData, {
    timeout: 60000,
    signal,
    onUploadProgress: onProgress,
  });
}

/**
 * 合并分片
 */
export function mergeChunks(fileHash, fileName, totalChunks) {
  return request.post("/merge-chunks", {
    fileHash,
    fileName,
    totalChunks,
  });
}
