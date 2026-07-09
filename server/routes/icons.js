// 图标管理路由 — CRUD + resolve + batch

const express = require("express")
const { authMiddleware } = require("../middleware/auth")
const {
  getIcons, getIconById, resolveIcon, createIcon, batchCreateIcons,
  updateIcon, deleteIcon, batchDeleteIcons, getIconNamesByGroup, getIconVersion,
} = require("../db/iconApi")

const router = express.Router()
router.use(authMiddleware)

// ⚠️ /icons/resolve 和 /icons/names 必须在 /icons/:id 之前注册，避免 :id 误匹配

/**
 * 解析图标（SvgIcon 组件核心接口）
 * GET /icons/resolve?name=object/history
 */
router.get("/resolve", async (req, res) => {
  try {
    const { name } = req.query
    if (!name || !name.includes("/")) {
      return res.status(400).json({ code: -1, msg: "参数格式错误，应为 分组/图标名" })
    }

    const lastSlash = name.lastIndexOf("/")
    const groupSlug = name.substring(0, lastSlash)
    const iconName = name.substring(lastSlash + 1)

    if (!groupSlug || !iconName) {
      return res.status(400).json({ code: -1, msg: "参数格式错误，应为 分组/图标名" })
    }

    const icon = await resolveIcon(groupSlug, iconName)
    if (!icon) {
      return res.status(404).json({ code: -1, msg: "图标不存在" })
    }

    res.json({ code: 0, data: { svgContent: icon.svgContent } })
  } catch (err) {
    console.error("解析图标失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 获取图标版本号（三级缓存：前端启动比对，不一致则清本地缓存）
 * GET /icons/version
 */
router.get("/version", async (req, res) => {
  try {
    const version = await getIconVersion()
    res.json({ code: 0, data: { version } })
  } catch (err) {
    console.error("获取图标版本号失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 获取分组下所有图标名称（前端重复检测用）
 * GET /icons/names?groupId=1
 */
router.get("/names", async (req, res) => {
  try {
    const { groupId } = req.query
    if (!groupId) return res.status(400).json({ code: -1, msg: "groupId不能为空" })

    const names = await getIconNamesByGroup(parseInt(groupId, 10))
    res.json({ code: 0, data: names })
  } catch (err) {
    console.error("获取图标名称列表失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 批量删除图标
 * DELETE /icons/batch
 */
router.delete("/batch", async (req, res) => {
  try {
    const { ids } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ code: -1, msg: "图标ID列表不能为空" })
    }

    const result = await batchDeleteIcons(ids)
    res.json({ code: 0, msg: `成功删除 ${result.count} 个图标` })
  } catch (err) {
    console.error("批量删除图标失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 批量导入图标
 * POST /icons/batch
 */
router.post("/batch", async (req, res) => {
  try {
    const { groupId, icons } = req.body

    if (!groupId) return res.status(400).json({ code: -1, msg: "所属分组不能为空" })
    if (!icons || !Array.isArray(icons) || icons.length === 0) {
      return res.status(400).json({ code: -1, msg: "图标列表不能为空" })
    }

    // 校验每个图标
    for (let i = 0; i < icons.length; i++) {
      const icon = icons[i]
      if (!icon.name || !icon.name.trim()) {
        return res.status(400).json({ code: -1, msg: `第${i + 1}个图标名称不能为空` })
      }
      if (!icon.svgContent || !icon.svgContent.includes("<svg")) {
        return res.status(400).json({ code: -1, msg: `第${i + 1}个图标SVG内容不合法` })
      }
    }

    const result = await batchCreateIcons(groupId, icons.map(icon => ({
      name: icon.name.trim(),
      description: (icon.description || "").trim(),
      svgContent: icon.svgContent,
    })))

    res.json({ code: 0, msg: `成功导入 ${result.count} 个图标` })
  } catch (err) {
    console.error("批量导入图标失败:", err)
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ code: -1, msg: "存在同名图标，请检查后重试" })
    }
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ code: -1, msg: "所属分组不存在" })
    }
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 获取图标列表（分页 + 搜索 + 分组过滤）
 * GET /icons?groupId=&keyword=&page=1&pageSize=24
 */
router.get("/", async (req, res) => {
  try {
    const { groupId, keyword = "", page = 1, pageSize = 24 } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 24))

    const result = await getIcons({
      groupId: groupId ? parseInt(groupId, 10) : undefined,
      keyword: keyword.trim() || undefined,
      page: pageNum,
      pageSize: size,
    })

    res.json({ code: 0, data: result })
  } catch (err) {
    console.error("获取图标列表失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 新增单个图标
 * POST /icons
 */
router.post("/", async (req, res) => {
  try {
    const { name, groupId, description = "", svgContent } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ code: -1, msg: "图标名称不能为空" })
    }
    if (!groupId) return res.status(400).json({ code: -1, msg: "所属分组不能为空" })
    if (!svgContent || !svgContent.includes("<svg")) {
      return res.status(400).json({ code: -1, msg: "SVG内容不合法" })
    }

    const result = await createIcon({
      name: name.trim(), groupId, description: description.trim(), svgContent,
    })

    res.json({ code: 0, msg: "图标创建成功", data: { id: result.id } })
  } catch (err) {
    console.error("创建图标失败:", err)
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ code: -1, msg: "该分组下已存在同名图标" })
    }
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ code: -1, msg: "所属分组不存在" })
    }
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 获取单个图标
 * GET /icons/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ code: -1, msg: "图标ID不合法" })

    const icon = await getIconById(id)
    if (!icon) return res.status(404).json({ code: -1, msg: "图标不存在" })

    res.json({ code: 0, data: icon })
  } catch (err) {
    console.error("获取图标详情失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 更新图标
 * PUT /icons/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ code: -1, msg: "图标ID不合法" })

    const { name, groupId, description = "", svgContent } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ code: -1, msg: "图标名称不能为空" })
    }
    if (!groupId) return res.status(400).json({ code: -1, msg: "所属分组不能为空" })
    if (!svgContent || !svgContent.includes("<svg")) {
      return res.status(400).json({ code: -1, msg: "SVG内容不合法" })
    }

    await updateIcon(id, { name: name.trim(), groupId, description: description.trim(), svgContent })

    res.json({ code: 0, msg: "图标更新成功" })
  } catch (err) {
    console.error("更新图标失败:", err)
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ code: -1, msg: "该分组下已存在同名图标" })
    }
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 删除单个图标
 * DELETE /icons/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ code: -1, msg: "图标ID不合法" })

    await deleteIcon(id)
    res.json({ code: 0, msg: "图标删除成功" })
  } catch (err) {
    console.error("删除图标失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

module.exports = router
