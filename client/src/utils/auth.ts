// auth.ts - 登录态、token 管理、401 刷新拦截
import { reactive } from 'vue'
import { request, setupAuthInterceptor, type ApiResponse, type User } from './api'

// ─── access token 只存在内存中（不落盘） ──────────────────
let accessToken: string | null = null

// 当前用户信息（响应式）
export interface AuthState {
  user: User | null
  isLoggedIn: boolean
}

export const authState = reactive<AuthState>({
  user: null,
  isLoggedIn: false,
})

// ─── Token 读写（闭包保护，外部只有 get/set） ──────────────

export function getAccessToken(): string | null {
  return accessToken
}

function setAccessToken(token: string) {
  accessToken = token
}

function clearAccessToken() {
  accessToken = null
}

// ─── 鉴权 API ─────────────────────────────────────────────

export interface LoginResult {
  access_token: string
  user: User
}

/**
 * 登录
 * 服务端通过 HttpOnly Cookie 下发 refresh_token
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const { data: res } = await request.post<ApiResponse<LoginResult>>('/auth/login', {
    username,
    password,
  })
  if (res.code !== 0) throw new Error(res.msg)

  setAccessToken(res.data.access_token)
  authState.user = res.data.user
  authState.isLoggedIn = true

  // 登录成功后加载权限与动态菜单（失败不阻断登录跳转）
  try {
    const { usePermissionStore } = await import('@/stores/permission')
    await usePermissionStore().load()
  } catch (err) {
    console.error('拉取动态菜单失败（不影响登录）:', err)
  }
  return res.data
}

/**
 * 刷新 access token（浏览器自动带 refresh_token Cookie）
 * 纯请求函数：并发去重与 401 重放统一由 api.ts 拦截器层负责，此处不再自建锁
 */
export async function refreshAccessToken(): Promise<string> {
  const { data: res } = await request.post<ApiResponse<LoginResult>>('/auth/refresh')
  if (res.code !== 0) {
    throw new Error(res.msg || '刷新失败')
  }
  setAccessToken(res.data.access_token)
  return res.data.access_token
}

/** 登出 */
export async function logout(): Promise<void> {
  try {
    await request.post('/auth/logout')
  } catch (err) {
    console.warn('登出接口异常（将被忽略）:', err)
  }
  clearAccessToken()
  authState.user = null
  authState.isLoggedIn = false
  // 清空权限状态
  const { usePermissionStore } = await import('@/stores/permission')
  usePermissionStore().reset()
  // 清空动态路由与历史 Tab，防止跨用户残留（越权访问）
  const { clearDynamicRoutes } = await import('@/router/dynamic')
  clearDynamicRoutes()
  const { useLayoutStore } = await import('@/stores/layout')
  useLayoutStore().resetVisited()
}

/**
 * 初始化认证：尝试刷新 token 恢复登录态
 * 返回 true 表示恢复成功，false 表示需要重新登录
 */
export async function initAuth(): Promise<boolean> {
  try {
    await refreshAccessToken()
    const { data: res } = await request.get<ApiResponse<{ user: User }>>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.code === 0 && res.data.user) {
      authState.user = res.data.user
      authState.isLoggedIn = true
      // 恢复登录态后加载权限与动态菜单（失败不阻断恢复）
      try {
        const { usePermissionStore } = await import('@/stores/permission')
        await usePermissionStore().load()
      } catch (err) {
        console.error('恢复登录态时拉取动态菜单失败:', err)
      }
      return true
    }
  } catch {
    /* 无法自动恢复，需重新登录 */
  }
  clearAccessToken()
  authState.user = null
  authState.isLoggedIn = false
  return false
}

/** 安装认证拦截器（在 main.ts 中调用一次） */
export function setupAuth(): void {
  setupAuthInterceptor({
    getToken: getAccessToken,
    doRefresh: refreshAccessToken,
    onAuthFailed: () => {
      clearAccessToken()
      authState.user = null
      authState.isLoggedIn = false
    },
  })
}
