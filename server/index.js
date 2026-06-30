const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// 上传文件存储目录
const UPLOAD_DIR = path.resolve(__dirname, "uploads");
const CHUNK_DIR = path.resolve(__dirname, "chunks");

// 确保目录存在
[UPLOAD_DIR, CHUNK_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json());

// multer 配置 - 分片存储到临时目录
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fileHash = req.body.fileHash;
    const chunkDir = path.resolve(CHUNK_DIR, fileHash);
    if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir, { recursive: true });
    cb(null, chunkDir);
  },
  filename: (req, file, cb) => {
    const chunkIndex = req.body.chunkIndex;
    cb(null, `${chunkIndex}`);
  },
});

const upload = multer({ storage });

/**
 * 检查文件是否已上传（秒传）或已上传哪些分片（断点续传）
 * GET /check-file
 * query: fileHash, fileName
 */
app.get("/check-file", (req, res) => {
  const { fileHash, fileName } = req.query;

  // 检查完整文件是否存在（秒传）
  const filePath = path.resolve(UPLOAD_DIR, fileHash, fileName);
  if (fs.existsSync(filePath)) {
    return res.json({ code: 0, data: { uploaded: true, uploadedChunks: [] } });
  }

  // 检查已上传的分片（断点续传）
  const chunkDir = path.resolve(CHUNK_DIR, fileHash);
  let uploadedChunks = [];
  if (fs.existsSync(chunkDir)) {
    uploadedChunks = fs.readdirSync(chunkDir).map(Number);
  }
  res.json({ code: 0, data: { uploaded: false, uploadedChunks } });
});

/**
 * 上传分片
 * POST /upload-chunk
 * formData: file, fileHash, chunkIndex
 */
app.post("/upload-chunk", upload.single("file"), (req, res) => {
  res.json({ code: 0, msg: "分片上传成功" });
});

/**
 * 合并分片
 * POST /merge-chunks
 * body: { fileHash, fileName, totalChunks }
 */
app.post("/merge-chunks", (req, res) => {
  const { fileHash, fileName, totalChunks } = req.body;

  const chunkDir = path.resolve(CHUNK_DIR, fileHash);
  const fileDir = path.resolve(UPLOAD_DIR, fileHash);

  if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });

  const filePath = path.resolve(fileDir, fileName);
  const writeStream = fs.createWriteStream(filePath);

  // 按分片顺序合并
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.resolve(chunkDir, `${i}`);
    if (!fs.existsSync(chunkPath)) {
      return res.json({ code: -1, msg: `分片 ${i} 不存在` });
    }
    const chunk = fs.readFileSync(chunkPath);
    writeStream.write(chunk);
  }

  writeStream.end();

  writeStream.on("finish", () => {
    // 合并完成后删除分片目录
    fs.rmSync(chunkDir, { recursive: true, force: true });
    res.json({
      code: 0,
      msg: "文件合并成功",
      data: { url: `/uploads/${fileHash}/${fileName}` },
    });
  });

  writeStream.on("error", () => {
    res.json({ code: -1, msg: "文件合并失败" });
  });
});

// 静态文件服务 - 提供已上传文件的访问
app.use("/uploads", express.static(UPLOAD_DIR));

app.listen(PORT, () => {
  console.log(`🚀 服务已启动: http://localhost:${PORT}`);
});
