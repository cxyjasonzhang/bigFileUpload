// auth.ts - 登录态、token 管理、401 刷新拦截
import { reactive } from 'vue'
import {
  request,
  setupAuthInterceptor,
  type ApiResponse,
  type User,
  fetchUserRoutes,
  fetchUserPermissions,
} from './api'

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
  console.log('[DEBUG-logout] login() 完成：isLoggedIn 已置 true，user =', authState.user?.username)

  // 登录成功后拉取动态菜单与权限（失败不阻断登录跳转）
  try {
    await loadDynamicAccess()
  } catch (err) {
    console.error('拉取动态菜单失败（不影响登录）:', err)
  }
  return res.data
}

/**
 * 拉取动态菜单 + 权限点，并注册动态路由
 * 登录与刷新恢复时都会调用
 */
export async function loadDynamicAccess(): Promise<void> {
  const { usePermissionStore } = await import('@/stores/permission')
  const { registerDynamicRoutes } = await import('@/router/dynamic')
  const permission = usePermissionStore()

  console.log('[DEBUG-nav] loadDynamicAccess 开始')

  // 拉取权限点与角色
  const permRes = await fetchUserPermissions()
  if (permRes.data.code === 0) {
    permission.setPermissions(permRes.data.data.perms, permRes.data.data.roles)
  }
  console.log('[DEBUG-nav] permissions code =', permRes.data.code)

  // 拉取动态菜单并组装树
  const routeRes = await fetchUserRoutes()
  if (routeRes.data.code === 0) {
    const list = routeRes.data.data.list
    console.log('[DEBUG-nav] routes code =', routeRes.data.code, '菜单数 =', list?.length)
    permission.setMenus(list)
    // 注册动态路由（幂等：重复调用会先清旧再注入）
    registerDynamicRoutes(permission.menuTree)
    permission.isRoutesLoaded = true
    console.log('[DEBUG-nav] 动态路由注册完成')
  } else {
    console.log('[DEBUG-nav] routes code 异常 =', routeRes.data.code, routeRes.data.msg)
  }
}

// ─── 刷新并发锁 ──────────────────────────────────────────
let isRefreshing = false
let refreshSubscribers: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function subscribeRefresh(cb: {
  resolve: (token: string) => void
  reject: (err: unknown) => void
}) {
  refreshSubscribers.push(cb)
}

/** 真正发起一次刷新请求 */
async function doRefreshInternal(): Promise<string> {
  const { data: res } = await request.post<ApiResponse<LoginResult>>('/auth/refresh')
  if (res.code !== 0) {
    throw new Error(res.msg || '刷新失败')
  }
  setAccessToken(res.data.access_token)
  return res.data.access_token
}

/**
 * 刷新 access token（浏览器自动带 refresh_token Cookie）
 * 并发调用时复用同一次请求结果，避免服务端 reuse 检测误杀
 */
export async function refreshAccessToken(): Promise<string> {
  if (isRefreshing) {
    // 已有刷新在飞，排队等结果即可
    return new Promise<string>((resolve, reject) => {
      subscribeRefresh({ resolve, reject })
    })
  }

  isRefreshing = true
  try {
    const token = await doRefreshInternal()
    refreshSubscribers.forEach((s) => s.resolve(token))
    return token
  } catch (err) {
    refreshSubscribers.forEach((s) => s.reject(err))
    throw err
  } finally {
    refreshSubscribers = []
    isRefreshing = false
  }
}

/** 登出 */
export async function logout(): Promise<void> {
  console.log('[DEBUG-logout] logout() 进入，当前 isLoggedIn =', authState.isLoggedIn)
  try {
    await request.post('/auth/logout')
    console.log('[DEBUG-logout] logout 接口已返回 200')
  } catch (err) {
    console.warn('[DEBUG-logout] logout 接口异常（将被忽略）:', err)
  }
  clearAccessToken()
  authState.user = null
  authState.isLoggedIn = false
  console.log('[DEBUG-logout] logout() 本地状态已清理：isLoggedIn = false')
  // 清空权限状态
  const { usePermissionStore } = await import('@/stores/permission')
  usePermissionStore().reset()
  console.log('[DEBUG-logout] logout() 权限 store 已 reset，函数即将返回')
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
      console.log(
        '[DEBUG-logout] initAuth() 恢复成功：isLoggedIn 已置 true，user =',
        authState.user?.username,
      )
      // 恢复登录态后拉取动态菜单与权限（失败不阻断恢复）
      try {
        await loadDynamicAccess()
      } catch (err) {
        console.error('恢复登录态时拉取动态菜单失败:', err)
      }
      return true
    }
  } catch (err) {
    /* 无法自动恢复，需重新登录 */
    console.log('[DEBUG-nav] initAuth 恢复失败:', err)
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
      console.warn('[DEBUG-logout] 拦截器 onAuthFailed 触发（refresh 失败）：本地状态将被清理')
      clearAccessToken()
      authState.user = null
      authState.isLoggedIn = false
    },
  })
}
