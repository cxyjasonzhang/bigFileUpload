const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

// 数据库操作
const { getAccount, insertAccount, updateAccount, deleteAccount } = require('../db/api')

const app = express();
const PORT = 3000;

// JWT 密钥（Demo 用硬编码，生产环境放环境变量）
const JWT_SECRET = process.env.JWT_SECRET || "demo-jwt-secret-change-in-production";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "demo-refresh-secret-change-in-production";
const ACCESS_TOKEN_EXPIRES = "15m";
const REFRESH_TOKEN_EXPIRES = "7d";
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 3600 * 1000; // 7 天（毫秒）

// 上传文件存储目录
const UPLOAD_DIR = path.resolve(__dirname, "uploads");
const CHUNK_DIR = path.resolve(__dirname, "chunks");

// 确保目录存在
[UPLOAD_DIR, CHUNK_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── 中间件 ───────────────────────────────────────────────
app.use(cors({
  origin: "http://localhost:5173",  // Vite 开发服务器
  credentials: true,                // ⚠️ 允许携带 Cookie
}));
app.use(express.json());
app.use(cookieParser());            // 解析 Cookie

// ─── Demo 用户数据 ─────────────────────────────────────────
const DEMO_USER = {
  id: "user_001",
  username: "admin",
  password: "admin123",
  name: "管理员",
};

// ─── refresh token 吊销表（内存版，生产用 Redis） ─────────
const revokedTokens = new Map();

// ─── 认证工具函数 ─────────────────────────────────────────

/**
 * 生成 access token（短时效，15 分钟）
 */
function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, name: user.name },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES },
  );
}

/**
 * 生成 refresh token（长时效，7 天）
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, jti: crypto.randomUUID() },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES },
  );
}

/**
 * 设置 refresh_token 到 HttpOnly Cookie
 */
function setRefreshTokenCookie(res, token) {
  res.cookie("refresh_token", token, {
    httpOnly: true,          // ← JS 不可读取（防 XSS）
    secure: false,           // Demo 用 HTTP，生产必须是 true（仅 HTTPS）
    sameSite: "lax",         // Demo 用 lax，生产建议 strict
    path: "/api/auth",     // 匹配前端 Vite 代理后的请求路径 /api/auth/*
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

/**
 * 清除 refresh_token Cookie
 */
function clearRefreshTokenCookie(res) {
  res.clearCookie("refresh_token", { path: "/api/auth" });
}

// ─── 认证中间件 ───────────────────────────────────────────

/**
 * 验证 access token，注入 req.user
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ code: -1, msg: "未登录，请先登录" });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ code: -1, msg: "登录已过期", expired: true });
    }
    return res.status(401).json({ code: -1, msg: "无效的登录凭证" });
  }
}

// ─── 认证接口 ─────────────────────────────────────────────

/**
 * 登录
 * POST /auth/login
 * body: { username, password }
 */
app.post("/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ code: -1, msg: "用户名和密码不能为空" });
  }

  // 验证用户
  if (username !== DEMO_USER.username || password !== DEMO_USER.password) {
    return res.status(401).json({ code: -1, msg: "用户名或密码错误" });
  }

  // 生成 token 对
  const accessToken = generateAccessToken(DEMO_USER);
  const refreshToken = generateRefreshToken(DEMO_USER);

  // refresh_token → HttpOnly Cookie
  setRefreshTokenCookie(res, refreshToken);

  // access_token → 响应 body（前端存内存）
  res.json({
    code: 0,
    msg: "登录成功",
    data: {
      access_token: accessToken,
      user: { id: DEMO_USER.id, username: DEMO_USER.username, name: DEMO_USER.name },
    },
  });
});

/**
 * 刷新 token
 * POST /auth/refresh
 * 浏览器自动携带 Cookie: refresh_token=xxx
 */
app.post("/auth/refresh", (req, res) => {
  const oldRefreshToken = req.cookies.refresh_token;
  if (!oldRefreshToken) {
    return res.status(401).json({ code: -1, msg: "未登录" });
  }

  try {
    const payload = jwt.verify(oldRefreshToken, REFRESH_SECRET);

    // 重用检测：如果 token 已被吊销 → 疑似攻击
    if (revokedTokens.has(payload.jti)) {
      clearRefreshTokenCookie(res);
      return res.status(403).json({ code: -1, msg: "登录凭证异常，请重新登录" });
    }

    // 吊销旧的 refresh token
    revokedTokens.set(payload.jti, Date.now());

    // 轮换新 token 对
    const accessToken = generateAccessToken(DEMO_USER);
    const newRefreshToken = generateRefreshToken(DEMO_USER);

    // 下发新的 refresh_token Cookie
    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      code: 0,
      data: { access_token: accessToken },
    });
  } catch (err) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({ code: -1, msg: "登录已过期，请重新登录" });
  }
});

/**
 * 登出
 * POST /auth/logout
 */
app.post("/auth/logout", (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  if (refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, REFRESH_SECRET);
      revokedTokens.set(payload.jti, Date.now());
    } catch { /* token 无效也清 Cookie */ }
  }
  clearRefreshTokenCookie(res);
  res.json({ code: 0, msg: "已退出登录" });
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
app.get("/auth/me", authMiddleware, (req, res) => {
  res.json({
    code: 0,
    data: {
      user: { id: req.user.sub, username: req.user.username, name: req.user.name },
    },
  });
});

// ─── 文件上传接口（需要登录） ──────────────────────────────

// multer 配置 - 分片存储到临时目录
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fileHash = req.body.fileHash;
    if (!fileHash || !/^[a-fA-F0-9]{32}$/.test(fileHash)) {
      return cb(new Error("非法的 fileHash"));
    }
    const chunkDir = path.resolve(CHUNK_DIR, fileHash);
    if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir, { recursive: true });
    cb(null, chunkDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.body.chunkIndex}`);
  },
});

const upload = multer({ storage });

/**
 * 检查文件是否已上传（秒传）或已上传哪些分片（断点续传）
 * GET /check-file
 */
app.get("/check-file", authMiddleware, (req, res) => {
  const { fileHash, fileName } = req.query;

  if (!fileHash || !/^[a-fA-F0-9]{32}$/.test(fileHash)) {
    return res.status(400).json({ code: -1, msg: "非法的 fileHash" });
  }

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
 */
app.post("/upload-chunk", authMiddleware, upload.single("file"), (req, res) => {
  res.json({ code: 0, msg: "分片上传成功" });
});

/**
 * 合并分片
 * POST /merge-chunks
 */
app.post("/merge-chunks", authMiddleware, (req, res) => {
  const { fileHash, fileName, totalChunks } = req.body;

  if (!fileHash || !/^[a-fA-F0-9]{32}$/.test(fileHash)) {
    return res.status(400).json({ code: -1, msg: "非法的 fileHash" });
  }

  const chunkDir = path.resolve(CHUNK_DIR, fileHash);
  const fileDir = path.resolve(UPLOAD_DIR, fileHash);

  if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });

  const filePath = path.resolve(fileDir, fileName);
  const writeStream = fs.createWriteStream(filePath);

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

// 静态文件服务
app.use("/uploads", express.static(UPLOAD_DIR));

app.listen(PORT, () => {
  console.log(`🚀 服务已启动: http://localhost:${PORT}`);
  console.log(`📋 Demo 账号: admin / admin123`);
});
