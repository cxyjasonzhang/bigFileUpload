import SparkMD5 from 'spark-md5'

self.onmessage = function (e) {
  const { file, chunkSize = 2 * 1024 * 1024 } = e.data
  const chunks = Math.ceil(file.size / chunkSize)
  const spark = new SparkMD5.ArrayBuffer()
  const reader = new FileReader()
  let currentChunk = 0

  reader.onload = (event) => {
    spark.append(event.target.result)
    currentChunk++
    self.postMessage({ type: 'progress', progress: Math.round((currentChunk / chunks) * 100) })

    if (currentChunk < chunks) {
      loadNext()
    } else {
      self.postMessage({ type: 'done', hash: spark.end() })
    }
  }

  reader.onerror = () => {
    self.postMessage({ type: 'error', error: reader.error })
  }

  function loadNext() {
    const start = currentChunk * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    reader.readAsArrayBuffer(file.slice(start, end))
  }

  loadNext()
}
