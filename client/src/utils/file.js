/**
 * 计算文件 hash（使用 Web Worker，不阻塞主线程）
 * @param {File} file - 文件对象
 * @param {Function} onProgress - 进度回调 (0~100)
 * @returns {Promise<string>} 文件 hash
 */
export function calculateFileHash(file, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./hash.worker.js', import.meta.url), { type: 'module' })

    worker.onmessage = (e) => {
      const { type, progress, hash, error } = e.data
      if (type === 'progress' && onProgress) {
        onProgress(progress)
      } else if (type === 'done') {
        worker.terminate()
        resolve(hash)
      } else if (type === 'error') {
        worker.terminate()
        reject(error)
      }
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(err)
    }

    worker.postMessage({ file, chunkSize: 2 * 1024 * 1024 })
  })
}

/**
 * 将文件切割为分片
 * @param {File} file - 文件对象
 * @param {number} chunkSize - 分片大小（默认 5MB）
 * @returns {Array} 分片数组
 */
export function createFileChunks(file, chunkSize = 5 * 1024 * 1024) {
  const chunks = []
  const totalChunks = Math.ceil(file.size / chunkSize)

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    chunks.push({
      index: i,
      file: file.slice(start, end),
    })
  }

  return chunks
}
