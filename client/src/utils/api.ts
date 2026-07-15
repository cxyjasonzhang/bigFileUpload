// api.ts - 统一请求封装与后端接口
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type AxiosRequestConfig,
  type AxiosProgressEvent,
  type AxiosError,
} from "axios";

const BASE_URL = "/api";

const request: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true, // ⚠️ 让浏览器携带 Cookie，refresh 接口必需
});

// ─── 通用响应类型 ─────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

// ─── 用户相关类型 ─────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  name?: string;
  phone?: string;
  homeAddress?: string;
  workLocation?: string;
  [key: string]: unknown;
}

export interface UserQuery {
  username?: string;
  phone?: string;
  page?: number;
  pageSize?: number;
}

export interface UserListResult {
  list: User[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── 图标相关类型 ─────────────────────────────────────────
export interface IconGroup {
  id: number;
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
  [key: string]: unknown;
}

export interface IconItem {
  id: number;
  name: string;
  groupId: number;
  description?: string;
  svgContent?: string;
  groupSlug?: string;
  [key: string]: unknown;
}

export interface IconListResult {
  list: IconItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IconInput {
  name: string;
  groupId: number;
  description?: string;
  svgContent: string;
}

// ─── 分片上传相关类型 ─────────────────────────────────────
export interface CheckFileResult {
  uploaded: boolean;
  uploadedChunks?: number[];
}

export interface IconVersion {
  version: number;
}

export { request };

// ─── 原有接口封装 ─────────────────────────────────────────

/** 检查文件是否已上传 */
export function checkFile(fileHash: string, fileName: string) {
  return request.get<ApiResponse<CheckFileResult>>("/check-file", {
    params: { fileHash, fileName },
    timeout: 10000,
  });
}

/** 上传分片 */
export function uploadChunk(
  formData: FormData,
  options: { signal?: AbortSignal; onProgress?: (e: AxiosProgressEvent) => void } = {},
) {
  return request.post(
    "/upload-chunk",
    formData,
    {
      timeout: 60000,
      signal: options.signal,
      onUploadProgress: options.onProgress,
    },
  );
}

/** 合并分片 */
export function mergeChunks(fileHash: string, fileName: string, totalChunks: number) {
  return request.post<ApiResponse<unknown>>(
    "/merge-chunks",
    { fileHash, fileName, totalChunks },
    { timeout: 300000 },
  );
}

// ─── 用户管理接口 ─────────────────────────────────────────

/** 获取用户列表（分页 + 搜索） */
export function fetchUsers(params: UserQuery = {}) {
  return request.get<ApiResponse<UserListResult>>("/users", { params });
}

/** 新建用户 */
export function createUser(data: Partial<User> & { username: string; phone: string }) {
  return request.post<ApiResponse<unknown>>("/users", data);
}

/** 编辑用户 */
export function updateUser(id: number, data: Partial<User>) {
  return request.put<ApiResponse<unknown>>(`/users/${id}`, data);
}

/** 删除用户 */
export function deleteUser(id: number) {
  return request.delete<ApiResponse<unknown>>(`/users/${id}`);
}

// ─── 图标管理接口 ─────────────────────────────────────────

/** 获取图标分组列表 */
export function getIconGroups() {
  return request.get<ApiResponse<IconGroup[]>>("/icon-groups");
}

/** 创建图标分组 */
export function createIconGroup(data: Partial<IconGroup> & { name: string; slug: string }) {
  return request.post<ApiResponse<unknown>>("/icon-groups", data);
}

/** 更新图标分组 */
export function updateIconGroup(id: number, data: Partial<IconGroup>) {
  return request.put<ApiResponse<unknown>>(`/icon-groups/${id}`, data);
}

/** 删除图标分组 */
export function deleteIconGroup(id: number) {
  return request.delete<ApiResponse<unknown>>(`/icon-groups/${id}`);
}

/** 获取图标列表（分页 + 搜索 + 分组过滤） */
export function getIcons(params: {
  groupId?: number | null;
  keyword?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  return request.get<ApiResponse<IconListResult>>("/icons", { params });
}

/** 解析图标（SvgIcon 组件使用） */
export function resolveIcon(name: string) {
  return request.get<ApiResponse<{ svgContent: string }>>("/icons/resolve", {
    params: { name },
  });
}

/** 获取图标版本号（三级缓存 B 方案：启动比对缓存失效） */
export function getIconVersion() {
  return request.get<ApiResponse<IconVersion>>("/icons/version");
}

/** 获取分组下所有图标名称（重复检测用） */
export function getIconNames(groupId: number) {
  return request.get<ApiResponse<string[]>>("/icons/names", {
    params: { groupId },
  });
}

/** 新增单个图标 */
export function createIcon(data: IconInput) {
  return request.post<ApiResponse<unknown>>("/icons", data);
}

/** 批量导入图标 */
export function batchCreateIcons(data: { groupId: number; icons: IconInput[] }) {
  return request.post<ApiResponse<unknown>>("/icons/batch", data);
}

/** 更新图标 */
export function updateIcon(id: number, data: IconInput) {
  return request.put<ApiResponse<unknown>>(`/icons/${id}`, data);
}

/** 删除图标 */
export function deleteIcon(id: number) {
  return request.delete<ApiResponse<unknown>>(`/icons/${id}`);
}

/** 批量删除图标 */
export function batchDeleteIcons(ids: number[]) {
  return request.delete<ApiResponse<unknown>>("/icons/batch", { data: { ids } });
}

// ─── 认证拦截器注册（由 auth.ts 的 setupAuth 调用） ───

export interface AuthInterceptorOptions {
  getToken: () => string | null;
  doRefresh: () => Promise<string>;
  onAuthFailed: () => void;
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

/**
 * 注册认证拦截器（避免循环引用，由外部调用）
 */
export function setupAuthInterceptor({
  getToken,
  doRefresh,
  onAuthFailed,
}: AuthInterceptorOptions) {
  // 请求拦截器：自动附加 Authorization 头
  request.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // 响应拦截器：401 自动刷新
  request.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as AxiosRequestConfig | undefined;
      const response = error.response;
      if (!response || response.status !== 401) {
        return Promise.reject(error);
      }

      // 刷新接口本身 401 → 直接失败
      if (
        config?.url?.includes("/auth/refresh") ||
        config?.url?.includes("/auth/login")
      ) {
        return Promise.reject(error);
      }

      // 别的请求 401 → 尝试刷新 token
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await doRefresh();
          isRefreshing = false;
          onRefreshed(newToken);
          if (config) {
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${newToken}`,
            };
            return request(config);
          }
          return Promise.reject(error);
        } catch {
          isRefreshing = false;
          refreshSubscribers = [];
          onAuthFailed();
          return Promise.reject(error);
        }
      }

      // 已有刷新在进行中，排队等待
      return new Promise((resolve) => {
        addRefreshSubscriber((token) => {
          if (config) {
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${token}`,
            };
            resolve(request(config));
          } else {
            resolve(request(error.config as AxiosRequestConfig));
          }
        });
      });
    },
  );
}
