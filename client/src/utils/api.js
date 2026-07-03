import axios from "axios";

const BASE_URL = "/api";

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true, // ⚠️ 让浏览器携带 Cookie，refresh 接口必需
});

export { request };

// ─── 原有接口封装 ─────────────────────────────────────────

/**
 * 检查文件是否已上传
 */
export function checkFile(fileHash, fileName) {
  return request.get("/check-file", {
    params: { fileHash, fileName },
    timeout: 10000,
  });
}

/**
 * 上传分片
 * @param {FormData} formData
 * @param {Object} options - { signal, onProgress }
 */
export function uploadChunk(formData, { signal, onProgress } = {}) {
  return request.post("/upload-chunk", formData, {
    timeout: 60000,
    signal,
    onUploadProgress: onProgress,
  });
}

/**
 * 合并分片
 */
export function mergeChunks(fileHash, fileName, totalChunks) {
  return request.post("/merge-chunks", {
    fileHash,
    fileName,
    totalChunks,
  }, {
    timeout: 300000,
  });
}

// ─── 认证拦截器注册（由 auth.js 的 setupAuthInterceptor 调用） ───

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

/**
 * 注册认证拦截器（避免循环引用，由外部调用）
 * @param {Function} getToken - 获取当前 access token 的函数
 * @param {Function} doRefresh - 执行刷新 token 的函数
 * @param {Function} onAuthFailed - 认证失败时的回调（跳转登录页）
 */
export function setupAuthInterceptor({ getToken, doRefresh, onAuthFailed }) {
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
    async (error) => {
      const { config, response } = error;
      if (!response || response.status !== 401) {
        return Promise.reject(error);
      }

      // 刷新接口本身 401 → 直接失败
      if (config.url?.includes("/auth/refresh") || config.url?.includes("/auth/login")) {
        return Promise.reject(error);
      }

      // 别的请求 401 → 尝试刷新 token
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await doRefresh();
          isRefreshing = false;
          onRefreshed(newToken);
          config.headers.Authorization = `Bearer ${newToken}`;
          return request(config);
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
          config.headers.Authorization = `Bearer ${token}`;
          resolve(request(config));
        });
      });
    }
  );
}
