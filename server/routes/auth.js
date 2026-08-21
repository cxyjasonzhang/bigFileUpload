// 认证路由 — 登录 / 刷新 / 登出 / 当前用户 / 动态菜单 / 权限点

const express = require("express");
const jwt = require("jsonwebtoken");
const {
  revokedTokens, REFRESH_SECRET,
  generateAccessToken, generateRefreshToken,
  setRefreshTokenCookie, clearRefreshTokenCookie,
  authMiddleware,
} = require("../middleware/auth");
const { verifyPassword } = require("../db/password");
const {
  getUserByAccount,
  getUserRoleCodes,
  isSuperAdmin,
  getUserMenus,
  getAllMenus,
} = require("../db/rbacApi");

const router = express.Router();

/**
 * 登录
 * POST /auth/login
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ code: -1, msg: "用户名和密码不能为空" });
    }

    const user = await getUserByAccount(username);
    if (!user) {
      return res.status(401).json({ code: -1, msg: "用户名或密码错误" });
    }
    if (user.status !== 1) {
      return res.status(403).json({ code: -1, msg: "账号已禁用，请联系管理员" });
    }
    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ code: -1, msg: "用户名或密码错误" });
    }

    const tokenUser = { id: user.id, account: user.account, username: user.username };
    const accessToken = generateAccessToken(tokenUser);
    const refreshToken = generateRefreshToken(tokenUser);

    setRefreshTokenCookie(res, refreshToken);

    res.json({
      code: 0,
      msg: "登录成功",
      data: {
        access_token: accessToken,
        user: { id: user.id, username: user.username, account: user.account },
      },
    });
  } catch (err) {
    console.error("登录失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 刷新 token
 * POST /auth/refresh
 */
router.post("/refresh", (req, res) => {
  const oldRefreshToken = req.cookies.refresh_token;
  if (!oldRefreshToken) {
    return res.status(401).json({ code: -1, msg: "未登录" });
  }

  try {
    const payload = jwt.verify(oldRefreshToken, REFRESH_SECRET);

    // 重用检测
    if (revokedTokens.has(payload.jti)) {
      clearRefreshTokenCookie(res);
      return res.status(403).json({ code: -1, msg: "登录凭证异常，请重新登录" });
    }

    revokedTokens.set(payload.jti, Date.now());

    // 用 token 里的 sub 重建（无需再查库，token 内已含身份）
    const tokenUser = { id: payload.sub, account: payload.account, username: payload.username };
    const accessToken = generateAccessToken(tokenUser);
    const newRefreshToken = generateRefreshToken(tokenUser);

    setRefreshTokenCookie(res, newRefreshToken);

    res.json({ code: 0, data: { access_token: accessToken } });
  } catch {
    clearRefreshTokenCookie(res);
    return res.status(401).json({ code: -1, msg: "登录已过期，请重新登录" });
  }
});

/**
 * 登出
 * POST /auth/logout
 */
router.post("/logout", (req, res) => {
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
 * 获取当前用户信息 + 角色 + 权限点集合
 * GET /auth/me
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.sub);
    const roleCodes = await getUserRoleCodes(userId);

    res.json({
      code: 0,
      data: {
        user: {
          id: userId,
          username: req.user.username,
          account: req.user.account,
        },
        roles: roleCodes,
      },
    });
  } catch (err) {
    console.error("获取当前用户失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 获取当前用户动态菜单（平铺列表，前端组装树 + 动态注册路由）
 * GET /auth/routes
 */
router.get("/routes", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.sub);
    const superAdmin = await isSuperAdmin(userId);

    // 超级管理员旁路：直接全量菜单
    const list = superAdmin ? await getAllMenus() : await getUserMenus(userId);

    res.json({ code: 0, data: { list } });
  } catch (err) {
    console.error("获取动态菜单失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 获取当前用户权限点集合（perms）与角色编码
 * GET /auth/permissions
 */
router.get("/permissions", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.sub);
    const roleCodes = await getUserRoleCodes(userId);
    const superAdmin = roleCodes.includes("R_SUPER");

    // 按钮权限点：从菜单平铺中筛出 menu_type=2 且有 perms 的节点
    const menus = superAdmin ? await getAllMenus() : await getUserMenus(userId);
    const perms = menus
      .filter((m) => m.menuType === 2 && m.perms)
      .map((m) => m.perms);

    res.json({ code: 0, data: { roles: roleCodes, perms } });
  } catch (err) {
    console.error("获取权限点失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

module.exports = router;
