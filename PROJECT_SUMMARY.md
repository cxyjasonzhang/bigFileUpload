# 大文件分片上传系统 — 项目总结

## 一、项目概述

一个基于 **Vue 3 + Express** 的大文件分片上传系统，支持秒传、断点续传、多任务队列管理、暂停/恢复/重试等完整的上传体验。前端采用 Vite 构建，使用 Element Plus 作为 UI 组件库；后端基于 Express + Multer 提供轻量级文件存储服务。

| 维度 | 技术选型 |
|------|----------|
| 前端框架 | Vue 3 (Composition API) |
| 构建工具 | Vite 6 |
| UI 组件库 | Element Plus 2 |
| HTTP 客户端 | Axios |
| 哈希计算 | SparkMD5 (Web Worker) |
| 状态管理 | Vue `reactive` + localStorage |
| 后端框架 | Express 4 |
| 文件接收 | Multer |
| 存储方式 | 本地文件系统 |

---

## 二、项目结构

```
bigFileUplaodDemo/
├── client/                          # 前端
│   ├── index.html                   # HTML 入口
│   ├── package.json                 # 依赖配置
│   ├── vite.config.js               # Vite 配置（含 /api 代理）
│   └── src/
│       ├── main.js                  # Vue 应用入口
│       ├── App.vue                  # 根组件（渐变背景布局）
│       ├── components/
│       │   └── FileUpload.vue       # 上传组件（拖拽区 + 任务列表）
│       └── utils/
│           ├── api.js               # API 封装（checkFile / uploadChunk / mergeChunks）
│           ├── file.js              # 文件工具（hash计算 / 分片切割）
│           ├── hash.worker.js       # Web Worker（SparkMD5 增量哈希）
│           └── uploadQueue.js       # 核心：上传任务队列管理
├── server/                          # 后端
│   ├── package.json                 # 依赖配置
│   ├── index.js                     # Express 服务（3 个 API + 静态文件）
│   ├── chunks/                      # 分片临时存储目录
│   └── uploads/                     # 合并后完整文件目录
└── .trae/documents/
    └── upload-task-queue-plan.md    # 功能规划文档
```

---

## 三、核心实现思路

### 3.1 整体流程

```
用户选择文件 → 加入任务队列 → 计算文件 HASH → 秒传检查
                                                    ↓
                                           ┌─ 已上传 → 标记成功
                                           └─ 未上传 → 查询已上传分片
                                                          ↓
                                                    补齐剩余分片 → 合并分片 → 完成
```

### 3.2 关键技术点

#### ① Web Worker 计算文件哈希（不阻塞 UI）

```
file.js (主线程)
  ├── new Worker("hash.worker.js")
  ├── worker.postMessage({ file, chunkSize: 2MB })
  └── worker.onmessage
        ├── type: "progress" → 更新 hashProgress
        └── type: "done"    → resolve(hash), worker.terminate()
```

- 使用 `SparkMD5.ArrayBuffer()` 以 **2MB/片** 逐片增量计算
- 每读完一片即通过 `postMessage` 回报进度
- 计算完成后立即 `terminate()` Worker 释放资源

#### ② 秒传 + 断点续传

```
checkFile(hash, fileName)
  ├── 完整文件已存在 → uploaded: true  → 秒传，直接标记成功
  └── 完整文件不存在 → uploaded: false → 返回已上传分片列表 uploadedChunks[]
                                           → 前端跳过已上传分片，只上传缺失部分
```

后端 `/check-file` 接口同时承载了「秒传」和「断点续传」两种场景，一次请求同时获取两个信息。

#### ③ 并发分片上传

```
_uploadChunks(taskId, chunks, skipChunks)
  ├── 过滤出未上传分片 → pendingChunks[]
  ├── 启动 CONCURRENT_LIMIT(3) 个 Worker
  │     └── 共享 index 指针，Worker 主动抢占下一个分片
  ├── 每个分片最多重试 MAX_RETRIES(3) 次
  └── 全部完成 → 进入合并阶段
```

并发模型：`CONCURRENT_LIMIT` 个异步 Worker 共享一个递增的 `index`（JS 单线程天然原子性），Worker 完成当前分片后自动抢占下一个分片，实现了简单的生产者-消费者模式。

#### ④ 任务队列与持久化

```
UploadQueue
  ├── tasks: reactive([])           ← Vue 响应式任务列表（自动驱动 UI）
  ├── fileMap: Map<id, File>         ← File 对象映射（不可序列化，仅内存）
  ├── abortControllerMap: Map        ← 每个任务的 AbortController
  │
  ├── localStorage 持久化策略
  │     ├── saveTasks() → JSON.stringify → localStorage
  │     ├── loadTasks() → JSON.parse → 重置 uploading/hashing → PAUSED
  │     └── 页面刷新后逐个调用 syncTaskWithServer() 同步服务端状态
  │
  └── 任务状态机
        PENDING → HASHING → UPLOADING → SUCCESS
           ↓         ↓          ↓
         PAUSED    PAUSED     PAUSED
                                ↓
                              ERROR
```

由于 `File`/`Blob` 对象无法序列化，刷新后用户需重新选择文件。通过计算 hash 匹配已有任务即可无缝恢复。

#### ⑤ 暂停/恢复机制

```
暂停：abortController.abort() → Axios 抛出 ERR_CANCELED → 标记 PAUSED
恢复：重置状态为 PENDING → 重新走 startTask 流程（跳过已上传分片）
```

#### ⑥ 服务端分片合并

```
mergeChunks → 按 chunkIndex 顺序遍历
  ├── fs.readFileSync(chunkPath) → writeStream.write(chunk)
  ├── writeStream.end()
  └── on("finish") → fs.rmSync 删除分片目录
```

采用流式写入 `fs.createWriteStream`，避免大文件全部加载到内存（不过 `readFileSync` 仍会将单个分片完整读入内存，对 5MB 分片影响可忽略）。

---

## 四、项目亮点

| # | 亮点 | 说明 |
|---|------|------|
| 1 | **Web Worker 非阻塞哈希** | 计算大文件 MD5 时 UI 完全不卡顿，通过 Worker 逐片计算并实时回报进度 |
| 2 | **完整的状态机设计** | 6 种状态（PENDING/HASHING/UPLOADING/PAUSED/SUCCESS/ERROR），状态流转清晰严谨 |
| 3 | **localStorage 持久化 + 服务端同步** | 刷新不丢失任务列表，重启后自动同步服务端分片状态，结合 hash 匹配实现无缝恢复 |
| 4 | **秒传 + 断点续传一体化** | 一次 `checkFile` 调用同时完成秒传判断和断点续传所需信息获取，协议设计简洁高效 |
| 5 | **智能并发控制** | 任务级单并发 + 分片级 3 并发，避免浏览器连接数限制，同时保证上传速度 |
| 6 | **按需重试** | 每个分片独立重试 3 次，失败不会影响已上传成功的分片 |
| 7 | **UI 交互细腻** | 根据状态动态切换按钮，文件重选恢复上传，已完成任务半透明删除线样式，清除已完成按钮 |
| 8 | **设计文档驱动开发** | `.trae/documents/` 下有完整的规划文档，决策清晰、假设明确 |
| 9 | **零数据库依赖** | 纯文件系统存储，localStorage 存元数据，部署成本极低 |
| 10 | **Vite 代理解耦** | 开发环境通过 Vite proxy 转发 `/api` 到后端，生产环境可独立部署 |

---

## 五、项目缺点与改进建议

### 5.1 🔴 功能性问题

| # | 问题 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| 1 | **重试无退避延迟** | `uploadQueue.js` `_uploadChunks` | 网络抖动时 3 次瞬时重试加剧拥堵，降低成功率 | 加入指数退避：`1000 * 2^retryCount ms` |
| 2 | **暂停后自动启动下一任务** | `uploadQueue.js` `startTask` finally 块 | 用户暂停当前任务时不应自动切换任务 | 先判断本任务状态是否为 PAUSED，再决定是否调用 `startNext` |
| 3 | **服务端合并使用 `readFileSync` 阻塞** | `server/index.js` 合并循环 | 大文件合并时阻塞事件循环，影响其他请求 | 改用流式管道 `fs.createReadStream.pipe()` + Promise 链 |

### 5.2 🟡 健壮性问题

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| 4 | **Task ID 使用 Math.random()** | `uploadQueue.js` `addTask` | 改用 `crypto.randomUUID()` 消除微小碰撞风险 |
| 5 | **localStorage 高频写入** | `uploadQueue.js` `updateTask` → `saveTasks` | 每完成一个分片写一次 localStorage，大文件可达数百次。建议做 500ms 节流 |
| 6 | **硬编码 axios 错误码** | `uploadQueue.js` 仅检查 `ERR_CANCELED` | 补充兼容 `CanceledError` / `AbortError` |
| 7 | **Error 对象与 paused 属性耦合** | `uploadQueue.js` `throw { paused: true }` | 改为抛出 `PausedError` 自定义类，语义更清晰 |
| 8 | **服务端未校验 totalChunks** | `server/index.js` merge 接口 | 攻击者可传入错误的 totalChunks 导致合并不完整，应校验实际分片数 |

### 5.3 🟢 体验优化

| # | 问题 | 建议 |
|---|------|------|
| 9 | **无上传速度显示** | 添加实时速率（MB/s）和预估剩余时间 |
| 10 | **无文件类型/大小校验** | 前端添加格式与大小限制，后端加白名单 |
| 11 | **错误信息不够细化** | 区分网络错误、服务端错误、文件错误，分别展示不同提示 |
| 12 | **无批量操作** | 添加全部暂停、全部开始、清空已完成等功能 |
| 13 | **无上传统计** | 添加总文件数、总大小、成功率等聚合数据 |
| 14 | **合并失败无回滚** | 合并失败后应保留分片目录，允许重试 |

---

## 六、架构简评

```
                    ┌──────────────────────────┐
                    │     FileUpload.vue        │
                    │  (UI: 拖拽区 + 任务列表)    │
                    └───────────┬──────────────┘
                                │ 调用
                    ┌───────────▼──────────────┐
                    │     uploadQueue.js        │
                    │  (状态机 + 队列 + 持久化)   │
                    └───┬───────┬──────┬───────┘
                        │       │      │
              ┌─────────▼──┐ ┌─▼────┐ ┌▼─────────┐
              │  file.js    │ │api.js│ │localStorage│
              │ hash + chunk│ │axios │ │  持久化    │
              └──────┬──────┘ └──┬───┘ └───────────┘
                     │           │
              ┌──────▼──┐  ┌────▼─────┐
              │  Worker  │  │ Express  │
              │ SparkMD5 │  │ + Multer │
              └──────────┘  └──────────┘
```

**职责分离清晰**：UI 层只负责渲染和事件分发，`uploadQueue.js` 承担全部业务逻辑，`api.js` 和 `file.js` 是纯粹的工具层。整体符合「关注点分离」原则，模块间耦合度低，易于测试和扩展。

**一条清晰的数据流**：`File → addTask → hashWorker → checkFile → uploadChunks → mergeChunks → SUCCESS`，每一步的状态变更都通过 `updateTask` 驱动 UI 响应式更新，数据流向单向可控。

---

## 七、总结

这是一个**架构设计良好、核心功能完整**的大文件上传系统 Demo，覆盖了生产环境中大文件上传的主要场景和边界情况。前端任务队列 + localStorage 持久化的设计在「无后端数据库」的约束下实现了较好的用户体验。

主要改进方向集中在 **健壮性增强**（重试策略、错误处理）和 **体验打磨**（速度展示、批量操作、统计面板）两个方面。整体代码质量扎实，模块划分清晰，适合作为大文件上传方案的学习参考或基础框架。 👍
