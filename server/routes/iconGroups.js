// 图标分组管理路由 — CRUD

const express = require("express")
const { authMiddleware } = require("../middleware/auth")
const { getGroups, getGroupById, createGroup, updateGroup, deleteGroup } = require("../db/iconApi")

const router = express.Router()
router.use(authMiddleware)

/**
 * 获取分组列表（含图标数量）
 * GET /icon-groups
 */
router.get("/", async (_req, res) => {
  try {
    const list = await getGroups()
    res.json({ code: 0, data: list })
  } catch (err) {
    console.error("获取分组列表失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 获取单个分组
 * GET /icon-groups/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ code: -1, msg: "分组ID不合法" })

    const group = await getGroupById(id)
    if (!group) return res.status(404).json({ code: -1, msg: "分组不存在" })

    res.json({ code: 0, data: group })
  } catch (err) {
    console.error("获取分组详情失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 创建分组
 * POST /icon-groups
 */
router.post("/", async (req, res) => {
  try {
    const { name, slug, description = "", sortOrder = 0 } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ code: -1, msg: "分组名称不能为空" })
    }
    if (!slug || !slug.trim()) {
      return res.status(400).json({ code: -1, msg: "分组标识(slug)不能为空" })
    }
    if (!/^[a-z0-9-]+$/.test(slug.trim())) {
      return res.status(400).json({ code: -1, msg: "分组标识仅允许小写字母、数字、短横线" })
    }

    const result = await createGroup({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      sortOrder,
    })

    res.json({ code: 0, msg: "分组创建成功", data: { id: result.id } })
  } catch (err) {
    console.error("创建分组失败:", err)
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ code: -1, msg: "分组标识已存在，请更换" })
    }
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 更新分组
 * PUT /icon-groups/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ code: -1, msg: "分组ID不合法" })

    const { name, slug, description = "", sortOrder = 0 } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ code: -1, msg: "分组名称不能为空" })
    }
    if (!slug || !slug.trim()) {
      return res.status(400).json({ code: -1, msg: "分组标识(slug)不能为空" })
    }
    if (!/^[a-z0-9-]+$/.test(slug.trim())) {
      return res.status(400).json({ code: -1, msg: "分组标识仅允许小写字母、数字、短横线" })
    }

    await updateGroup(id, {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      sortOrder,
    })

    res.json({ code: 0, msg: "分组更新成功" })
  } catch (err) {
    console.error("更新分组失败:", err)
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ code: -1, msg: "分组标识已存在，请更换" })
    }
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

/**
 * 删除分组（级联删除图标）
 * DELETE /icon-groups/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ code: -1, msg: "分组ID不合法" })

    await deleteGroup(id)
    res.json({ code: 0, msg: "分组删除成功" })
  } catch (err) {
    console.error("删除分组失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误" })
  }
})

module.exports = router
