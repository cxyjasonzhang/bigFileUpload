// 用户管理路由 — CRUD

const express = require("express")
const { authMiddleware } = require("../middleware/auth")
const { getUserList, insertUser, updateUser, deleteUser } = require("../db/api")

const router = express.Router()

// 所有用户接口需登录
router.use(authMiddleware)

/**
 * 查询用户列表（分页 + 搜索）
 * GET /users?username=&phone=&page=1&pageSize=10
 */
router.get("/", async (req, res) => {
  try {
    const { username = "", phone = "", page = 1, pageSize = 10 } = req.query

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const size = [10, 20, 30].includes(parseInt(pageSize, 10))
      ? parseInt(pageSize, 10)
      : 10

    const { list, total } = await getUserList({
      username: username.trim() || undefined,
      phone: phone.trim() || undefined,
      page: pageNum,
      pageSize: size,
    })

    res.json({
      code: 0,
      data: { list, total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size) },
    })
  } catch (err) {
    console.error("查询用户列表失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" })
  }
})

/**
 * 新建用户
 * POST /users
 */
router.post("/", async (req, res) => {
  try {
    const { username, phone, homeAddress = "", workLocation = "" } = req.body

    if (!username || !username.trim()) {
      return res.status(400).json({ code: -1, msg: "姓名不能为空" })
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ code: -1, msg: "手机号不能为空" })
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      return res.status(400).json({ code: -1, msg: "手机号格式不正确" })
    }

    await insertUser({
      username: username.trim(),
      phone: phone.trim(),
      homeAddress: homeAddress.trim(),
      workLocation: workLocation.trim(),
    })

    res.json({ code: 0, msg: "新建用户成功" })
  } catch (err) {
    console.error("新建用户失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" })
  }
})

/**
 * 编辑用户
 * PUT /users/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ code: -1, msg: "用户ID不合法" })

    const { username, phone, homeAddress = "", workLocation = "" } = req.body

    if (!username || !username.trim()) {
      return res.status(400).json({ code: -1, msg: "姓名不能为空" })
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ code: -1, msg: "手机号不能为空" })
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      return res.status(400).json({ code: -1, msg: "手机号格式不正确" })
    }

    await updateUser(id, {
      username: username.trim(),
      phone: phone.trim(),
      homeAddress: homeAddress.trim(),
      workLocation: workLocation.trim(),
    })

    res.json({ code: 0, msg: "编辑用户成功" })
  } catch (err) {
    console.error("编辑用户失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" })
  }
})

/**
 * 删除用户
 * DELETE /users/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ code: -1, msg: "用户ID不合法" })

    await deleteUser(id)
    res.json({ code: 0, msg: "删除用户成功" })
  } catch (err) {
    console.error("删除用户失败:", err)
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" })
  }
})

module.exports = router
