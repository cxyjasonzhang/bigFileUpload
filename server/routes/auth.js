// 认证路由 — 登录 / 刷新 / 登出 / 获取当前用户

const express = require("express")
const {
  DEMO_USER, revokedTokens, REFRESH_SECRET,
  generateAccessToken, generateRefreshToken,
  setRefreshTokenCookie, clearRefreshTokenCookie,
  authMiddleware,
} = require("../middleware/auth")

const router = express.Router()

/**
 * 登录
 * POST /auth/login
 */
router.post("/login", (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ code: -1, msg: "用户名和密码不能为空" })
  }

  if (username !== DEMO_USER.username || password !== DEMO_USER.password) {
    return res.status(401).json({ code: -1, msg: "用户名或密码错误" })
  }

  const accessToken = generateAccessToken(DEMO_USER)
  const refreshToken = generateRefreshToken(DEMO_USER)

  setRefreshTokenCookie(res, refreshToken)

  res.json({
    code: 0,
    msg: "登录成功",
    data: {
      access_token: accessToken,
      user: { id: DEMO_USER.id, username: DEMO_USER.username, name: DEMO_USER.name },
    },
  })
})

/**
 * 刷新 token
 * POST /auth/refresh
 */
router.post("/refresh", (req, res) => {
  const oldRefreshToken = req.cookies.refresh_token
  if (!oldRefreshToken) {
    return res.status(401).json({ code: -1, msg: "未登录" })
  }

  try {
    const payload = require("jsonwebtoken").verify(oldRefreshToken, REFRESH_SECRET)

    // 重用检测
    if (revokedTokens.has(payload.jti)) {
      clearRefreshTokenCookie(res)
      return res.status(403).json({ code: -1, msg: "登录凭证异常，请重新登录" })
    }

    revokedTokens.set(payload.jti, Date.now())

    const accessToken = generateAccessToken(DEMO_USER)
    const newRefreshToken = generateRefreshToken(DEMO_USER)

    setRefreshTokenCookie(res, newRefreshToken)

    res.json({ code: 0, data: { access_token: accessToken } })
  } catch {
    clearRefreshTokenCookie(res)
    return res.status(401).json({ code: -1, msg: "登录已过期，请重新登录" })
  }
})

/**
 * 登出
 * POST /auth/logout
 */
router.post("/logout", (req, res) => {
  const refreshToken = req.cookies.refresh_token
  if (refreshToken) {
    try {
      const payload = require("jsonwebtoken").verify(refreshToken, REFRESH_SECRET)
      revokedTokens.set(payload.jti, Date.now())
    } catch { /* token 无效也清 Cookie */ }
  }
  clearRefreshTokenCookie(res)
  res.json({ code: 0, msg: "已退出登录" })
})

/**
 * 获取当前用户信息
 * GET /auth/me
 */
router.get("/me", authMiddleware, (req, res) => {
  res.json({
    code: 0,
    data: {
      user: { id: req.user.sub, username: req.user.username, name: req.user.name },
    },
  })
})

module.exports = router
