// auth.ts - 登录态、token 管理、401 刷新拦截
import { reactive } from "vue";
import {
  request,
  setupAuthInterceptor,
  type ApiResponse,
  type User,
} from "./api";

// ─── access token 只存在内存中（不落盘） ──────────────────
let accessToken: string | null = null;

// 当前用户信息（响应式）
export interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
}

export const authState = reactive<AuthState>({
  user: null,
  isLoggedIn: false,
});

// ─── Token 读写（闭包保护，外部只有 get/set） ──────────────

export function getAccessToken(): string | null {
  return accessToken;
}

function setAccessToken(token: string) {
  accessToken = token;
}

function clearAccessToken() {
  accessToken = null;
}

// ─── 鉴权 API ─────────────────────────────────────────────

export interface LoginResult {
  access_token: string;
  user: User;
}

/**
 * 登录
 * 服务端通过 HttpOnly Cookie 下发 refresh_token
 */
export async function login(
  username: string,
  password: string,
): Promise<LoginResult> {
  const { data: res } = await request.post<ApiResponse<LoginResult>>(
    "/auth/login",
    { username, password },
  );
  if (res.code !== 0) throw new Error(res.msg);

  setAccessToken(res.data.access_token);
  authState.user = res.data.user;
  authState.isLoggedIn = true;
  return res.data;
}

// ─── 刷新并发锁 ──────────────────────────────────────────
let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function subscribeRefresh(cb: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}) {
  refreshSubscribers.push(cb);
}

/** 真正发起一次刷新请求 */
async function doRefreshInternal(): Promise<string> {
  const { data: res } = await request.post<ApiResponse<LoginResult>>(
    "/auth/refresh",
  );
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
export async function refreshAccessToken(): Promise<string> {
  if (isRefreshing) {
    // 已有刷新在飞，排队等结果即可
    return new Promise<string>((resolve, reject) => {
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

/** 登出 */
export async function logout(): Promise<void> {
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
export async function initAuth(): Promise<boolean> {
  try {
    await refreshAccessToken();
    const { data: res } = await request.get<ApiResponse<{ user: User }>>(
      "/auth/me",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
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

/** 安装认证拦截器（在 main.ts 中调用一次） */
export function setupAuth(): void {
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
