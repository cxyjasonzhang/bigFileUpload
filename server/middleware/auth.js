// 认证中间件 — JWT 工具函数 + 鉴权逻辑 + 共享数据

const jwt = require("jsonwebtoken")
const crypto = require("crypto")

// JWT 密钥（Demo 用硬编码，生产环境放环境变量）
const JWT_SECRET = process.env.JWT_SECRET || "demo-jwt-secret-change-in-production"
const REFRESH_SECRET = process.env.REFRESH_SECRET || "demo-refresh-secret-change-in-production"
const ACCESS_TOKEN_EXPIRES = "15m"
const REFRESH_TOKEN_EXPIRES = "7d"
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 3600 * 1000 // 7 天（毫秒）

// Demo 用户数据
const DEMO_USER = {
  id: "user_001",
  username: "admin",
  password: "admin123",
  name: "管理员",
}

// refresh token 吊销表（内存版，生产用 Redis）
const revokedTokens = new Map()

/**
 * 生成 access token（短时效，15 分钟）
 */
function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, name: user.name },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES },
  )
}

/**
 * 生成 refresh token（长时效，7 天）
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, jti: crypto.randomUUID() },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES },
  )
}

/**
 * 设置 refresh_token 到 HttpOnly Cookie
 */
function setRefreshTokenCookie(res, token) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: false,          // Demo 用 HTTP，生产必须是 true（仅 HTTPS）
    sameSite: "lax",
    path: "/auth",          // 匹配前端 Vite 代理后的请求路径 /auth/*
    maxAge: REFRESH_TOKEN_MAX_AGE,
  })
}

/**
 * 清除 refresh_token Cookie
 */
function clearRefreshTokenCookie(res) {
  res.clearCookie("refresh_token", { path: "/auth" })
}

/**
 * JWT 鉴权中间件 — 验证 access token，注入 req.user
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ code: -1, msg: "未登录，请先登录" })
  }

  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ code: -1, msg: "登录已过期", expired: true })
    }
    return res.status(401).json({ code: -1, msg: "无效的登录凭证" })
  }
}

module.exports = {
  DEMO_USER,
  revokedTokens,
  JWT_SECRET,
  REFRESH_SECRET,
  generateAccessToken,
  generateRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  authMiddleware,
}
