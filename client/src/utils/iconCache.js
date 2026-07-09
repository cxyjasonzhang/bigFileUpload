// iconCache.js - 图标三级缓存（内存 → IndexedDB → 网络）
//
// 三级：
//   L1 内存   memory: Map<name, svgContent>        （最快，刷新即失）
//   L2 IndexedDB  store "icons" { name, svgContent, savedAt }（跨刷新/会话持久）
//   L3 网络    api.resolveIcon(name)                    （兜底）
//
// 失效策略（详见设计文档）：
//   A 主动失效：图标增删改后调 invalidate / invalidateAll
//   B 全局版本：checkVersion 启动比对后端 icon_version，不符则清全库
//
// 并发合并：同一 name 的多个调用共享一个进行中的 Promise，只发 1 次网络。

import { openDB } from 'idb'
import { resolveIcon, getIconVersion } from '@/utils/api'

const DB_NAME = 'icon-cache'
const DB_VERSION = 1
const ICONS_STORE = 'icons'
const META_STORE = 'meta'
const VERSION_KEY = 'iconVersion'

// L1 内存缓存（已解析的 SVG 字符串）
const memory = new Map()
// 进行中的请求（用于并发合并）
const pending = new Map()

let dbPromise = null

/**
 * 获取（或初始化）IndexedDB 连接，失败返回 null（降级为仅内存）
 */
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(ICONS_STORE)) {
          db.createObjectStore(ICONS_STORE, { keyPath: 'name' })
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' })
        }
      },
    }).catch((err) => {
      console.warn('IndexedDB 不可用，图标缓存降级为仅内存:', err)
      dbPromise = null
      return null
    })
  }
  return dbPromise
}

// ─── L2 读写（全部吞错，失败不影响主流程） ─────────

async function idbGetIcon(name) {
  const db = await getDB()
  if (!db) return null
  try {
    return await db.get(ICONS_STORE, name)
  } catch {
    return null
  }
}

async function idbSetIcon(name, svgContent) {
  const db = await getDB()
  if (!db) return
  try {
    await db.put(ICONS_STORE, { name, svgContent, savedAt: Date.now() })
  } catch {
    // 隐私模式等场景写入失败，忽略
  }
}

async function idbDeleteIcon(name) {
  const db = await getDB()
  if (!db) return
  try {
    await db.delete(ICONS_STORE, name)
  } catch { /* 忽略 */ }
}

async function idbClearIcons() {
  const db = await getDB()
  if (!db) return
  try {
    await db.clear(ICONS_STORE)
  } catch { /* 忽略 */ }
}

async function metaGet(key) {
  const db = await getDB()
  if (!db) return null
  try {
    const rec = await db.get(META_STORE, key)
    return rec?.value ?? null
  } catch {
    return null
  }
}

async function metaSet(key, value) {
  const db = await getDB()
  if (!db) return
  try {
    await db.put(META_STORE, { key, value })
  } catch { /* 忽略 */ }
}

// ─── 对外 API ───────────────────────────────────────

/**
 * 读取图标：L1 → L2 → L3，含并发合并
 * @param {string} name - 格式 "分组slug/图标名"
 * @returns {Promise<string>} SVG 内容；网络失败则抛出
 */
export async function get(name) {
  if (!name) return ''

  // L1 命中
  if (memory.has(name)) return memory.get(name)
  // 并发合并：复用进行中的同一个 Promise
  if (pending.has(name)) return pending.get(name)

  const task = (async () => {
    // L2 命中
    const rec = await idbGetIcon(name)
    if (rec?.svgContent) {
      memory.set(name, rec.svgContent)
      return rec.svgContent
    }
    // L3 网络兜底
    const res = await resolveIcon(name)
    const svg = res.data?.data?.svgContent || ''
    memory.set(name, svg)
    await idbSetIcon(name, svg)
    return svg
  })()

  pending.set(name, task)
  try {
    return await task
  } finally {
    pending.delete(name)
  }
}

/**
 * A：单图标失效（内存 + IndexedDB）
 */
export async function invalidate(name) {
  if (!name) return
  memory.delete(name)
  pending.delete(name)
  await idbDeleteIcon(name)
}

/**
 * A：整库失效（批量增删时使用）
 */
export async function invalidateAll() {
  memory.clear()
  pending.clear()
  await idbClearIcons()
}

/**
 * B：启动比对版本号，不一致则清全库并写入新版本
 * 仅启动调用一次；版本接口不可用时静默跳过（不误清缓存）
 */
export async function checkVersion() {
  try {
    const res = await getIconVersion()
    const server = res.data?.data?.version
    if (typeof server !== 'number') return
    const local = await metaGet(VERSION_KEY)
    if (local !== null && local === server) return
    await invalidateAll()
    await metaSet(VERSION_KEY, server)
  } catch {
    // 版本接口失败，跳过比对
  }
}

/**
 * A：图标变更后调用，刷新本地版本号，避免下次启动误判全清
 */
export async function refreshVersion() {
  try {
    const res = await getIconVersion()
    const server = res.data?.data?.version
    if (typeof server === 'number') {
      await metaSet(VERSION_KEY, server)
    }
  } catch {
    // 忽略
  }
}
