// 大文件上传 & SVG 图标管理 — 服务端入口

const express = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser")

const app = express()
const PORT = 3000

// ─── 全局中间件 ─────────────────────────────────────────
app.use(cors({ origin: "http://localhost:5173", credentials: true }))
app.use(express.json())
app.use(cookieParser())

// ─── 静态文件服务 ───────────────────────────────────────
const path = require("path")
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")))

// ─── 挂载路由模块 ──────────────────────────────────────
app.use("/auth",        require("./routes/auth"))
app.use("/users",       require("./routes/users"))
app.use("/icon-groups", require("./routes/iconGroups"))
app.use("/icons",       require("./routes/icons"))
app.use("/",            require("./routes/upload"))   // /check-file, /upload-chunk, /merge-chunks

// ─── 启动服务 ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 服务已启动: http://localhost:${PORT}`)
  console.log(`📋 Demo 账号: admin / admin123`)
})
