// 文件上传路由 — 秒传检测 / 分片上传 / 合并

const express = require("express")
const multer = require("multer")
const fs = require("fs")
const path = require("path")
const { authMiddleware } = require("../middleware/auth")

const UPLOAD_DIR = path.resolve(__dirname, "..", "uploads")
const CHUNK_DIR = path.resolve(__dirname, "..", "chunks")

// 确保目录存在
;[UPLOAD_DIR, CHUNK_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
})

const router = express.Router()
router.use(authMiddleware)

// multer 配置 — 分片存储到临时目录
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fileHash = req.body.fileHash
    if (!fileHash || !/^[a-fA-F0-9]{32}$/.test(fileHash)) {
      return cb(new Error("非法的 fileHash"))
    }
    const chunkDir = path.resolve(CHUNK_DIR, fileHash)
    if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir, { recursive: true })
    cb(null, chunkDir)
  },
  filename: (req, file, cb) => {
    cb(null, `${req.body.chunkIndex}`)
  },
})

const upload = multer({ storage })

/**
 * 检查文件是否已上传（秒传）或已上传哪些分片（断点续传）
 * GET /check-file
 */
router.get("/check-file", (req, res) => {
  const { fileHash, fileName } = req.query

  if (!fileHash || !/^[a-fA-F0-9]{32}$/.test(fileHash)) {
    return res.status(400).json({ code: -1, msg: "非法的 fileHash" })
  }

  // 完整文件已存在 → 秒传
  const filePath = path.resolve(UPLOAD_DIR, fileHash, fileName)
  if (fs.existsSync(filePath)) {
    return res.json({ code: 0, data: { uploaded: true, uploadedChunks: [] } })
  }

  // 检查已上传的分片
  const chunkDir = path.resolve(CHUNK_DIR, fileHash)
  let uploadedChunks = []
  if (fs.existsSync(chunkDir)) {
    uploadedChunks = fs.readdirSync(chunkDir).map(Number)
  }
  res.json({ code: 0, data: { uploaded: false, uploadedChunks } })
})

/**
 * 上传分片
 * POST /upload-chunk
 */
router.post("/upload-chunk", upload.single("file"), (req, res) => {
  res.json({ code: 0, msg: "分片上传成功" })
})

/**
 * 合并分片
 * POST /merge-chunks
 */
router.post("/merge-chunks", (req, res) => {
  const { fileHash, fileName, totalChunks } = req.body

  if (!fileHash || !/^[a-fA-F0-9]{32}$/.test(fileHash)) {
    return res.status(400).json({ code: -1, msg: "非法的 fileHash" })
  }

  const chunkDir = path.resolve(CHUNK_DIR, fileHash)
  const fileDir = path.resolve(UPLOAD_DIR, fileHash)

  if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true })

  const filePath = path.resolve(fileDir, fileName)
  const writeStream = fs.createWriteStream(filePath)

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.resolve(chunkDir, `${i}`)
    if (!fs.existsSync(chunkPath)) {
      return res.json({ code: -1, msg: `分片 ${i} 不存在` })
    }
    writeStream.write(fs.readFileSync(chunkPath))
  }

  writeStream.end()

  writeStream.on("finish", () => {
    fs.rmSync(chunkDir, { recursive: true, force: true })
    res.json({ code: 0, msg: "文件合并成功", data: { url: `/uploads/${fileHash}/${fileName}` } })
  })

  writeStream.on("error", () => {
    res.json({ code: -1, msg: "文件合并失败" })
  })
})

module.exports = router
