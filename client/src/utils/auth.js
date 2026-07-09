import { reactive } from "vue";
import { request, setupAuthInterceptor } from "./api.js";

// ─── access token 只存在内存中（不落盘） ──────────────────
let accessToken = null;

// 当前用户信息（响应式）
export const authState = reactive({
  user: null,
  isLoggedIn: false,
});

// ─── Token 读写（闭包保护，外部只有 get/set） ──────────────

export function getAccessToken() {
  return accessToken;
}

function setAccessToken(token) {
  accessToken = token;
}

function clearAccessToken() {
  accessToken = null;
}

// ─── 鉴权 API ─────────────────────────────────────────────

/**
 * 登录
 * 服务端通过 HttpOnly Cookie 下发 refresh_token
 */
export async function login(username, password) {
  const { data: res } = await request.post("/auth/login", { username, password });
  if (res.code !== 0) throw new Error(res.msg);

  setAccessToken(res.data.access_token);
  authState.user = res.data.user;
  authState.isLoggedIn = true;
  return res.data;
}

// ─── 刷新并发锁：保证任意时刻只有一个 /auth/refresh 真正发出 ──
// 页面刷新时 initAuth() 与多个业务请求的 401 拦截会同时触发刷新，
// 若并发发出多个 /auth/refresh，服务端的 refresh token 重用检测会把
// 同一旧 token 的第二个请求判为"凭证异常" → 登录态丢失。
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeRefresh(cb) {
  refreshSubscribers.push(cb);
}

/**
 * 真正发起一次刷新请求
 */
async function doRefreshInternal() {
  const { data: res } = await request.post("/auth/refresh");
  if (res.code !== 0) {
    throw new Error(res.msg || "刷新失败");
  }
  setAccessToken(res.data.access_token);
  return res.data.access_token;
}

/**
 * 刷新 access token（浏览器自动带 refresh_token Cookie）
 * 并发调用时复用同一次请求结果，避免服务端 reuse 检测误杀
 */
export async function refreshAccessToken() {
  if (isRefreshing) {
    // 已有刷新在飞，排队等结果即可
    return new Promise((resolve, reject) => {
      subscribeRefresh({ resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    const token = await doRefreshInternal();
    refreshSubscribers.forEach((s) => s.resolve(token));
    return token;
  } catch (err) {
    refreshSubscribers.forEach((s) => s.reject(err));
    throw err;
  } finally {
    refreshSubscribers = [];
    isRefreshing = false;
  }
}

/**
 * 登出
 */
export async function logout() {
  try {
    await request.post("/auth/logout");
  } catch {
    /* 忽略网络错误 */
  }
  clearAccessToken();
  authState.user = null;
  authState.isLoggedIn = false;
}

/**
 * 初始化认证：尝试刷新 token 恢复登录态
 * 返回 true 表示恢复成功，false 表示需要重新登录
 */
export async function initAuth() {
  try {
    await refreshAccessToken();
    const { data: res } = await request.get("/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.code === 0 && res.data.user) {
      authState.user = res.data.user;
      authState.isLoggedIn = true;
      return true;
    }
  } catch {
    /* 无法自动恢复，需重新登录 */
  }
  clearAccessToken();
  authState.user = null;
  authState.isLoggedIn = false;
  return false;
}

/**
 * 安装认证拦截器（在 main.js 中调用一次）
 */
export function setupAuth() {
  setupAuthInterceptor({
    getToken: getAccessToken,
    doRefresh: refreshAccessToken,
    onAuthFailed: () => {
      clearAccessToken();
      authState.user = null;
      authState.isLoggedIn = false;
    },
  });
}
