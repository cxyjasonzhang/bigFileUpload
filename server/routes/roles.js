// 角色管理路由 — CRUD

const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { getRoleList, insertRole, updateRole, deleteRole } = require("../db/roleApi");
const { getRoleMenuIds, saveRoleMenus, getAllMenus } = require("../db/rbacApi");

const router = express.Router();

// 所有角色接口需登录
router.use(authMiddleware);

/**
 * 查询角色列表（分页 + 搜索）
 * GET /roles?roleName=&roleCode=&enabled=1&page=1&pageSize=10
 */
router.get("/", async (req, res) => {
  try {
    const { roleName = "", roleCode = "", enabled, page = 1, pageSize = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = [10, 20, 30].includes(parseInt(pageSize, 10))
      ? parseInt(pageSize, 10)
      : 10;

    const { list, total } = await getRoleList({
      roleName: roleName.trim() || undefined,
      roleCode: roleCode.trim() || undefined,
      // enabled 为空字符串/未传时不作为查询条件
      enabled: enabled === "" || enabled === undefined ? undefined : Number(enabled),
      page: pageNum,
      pageSize: size,
    });

    res.json({
      code: 0,
      data: { list, total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size) },
    });
  } catch (err) {
    console.error("查询角色列表失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 新建角色
 * POST /roles
 */
router.post("/", async (req, res) => {
  try {
    const { roleName, roleCode, description = "", enabled = 1 } = req.body;

    if (!roleName || !roleName.trim()) {
      return res.status(400).json({ code: -1, msg: "角色名称不能为空" });
    }
    if (!roleCode || !roleCode.trim()) {
      return res.status(400).json({ code: -1, msg: "角色编码不能为空" });
    }

    await insertRole({
      roleName: roleName.trim(),
      roleCode: roleCode.trim().toUpperCase(),
      description: description.trim(),
      enabled,
    });

    res.json({ code: 0, msg: "新建角色成功" });
  } catch (err) {
    console.error("新建角色失败:", err);
    // 唯一索引冲突
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ code: -1, msg: "角色编码已存在" });
    }
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 编辑角色
 * PUT /roles/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: -1, msg: "角色ID不合法" });

    const { roleName, roleCode, description = "", enabled = 1 } = req.body;

    if (!roleName || !roleName.trim()) {
      return res.status(400).json({ code: -1, msg: "角色名称不能为空" });
    }
    if (!roleCode || !roleCode.trim()) {
      return res.status(400).json({ code: -1, msg: "角色编码不能为空" });
    }

    await updateRole(id, {
      roleName: roleName.trim(),
      roleCode: roleCode.trim().toUpperCase(),
      description: description.trim(),
      enabled,
    });

    res.json({ code: 0, msg: "编辑角色成功" });
  } catch (err) {
    console.error("编辑角色失败:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ code: -1, msg: "角色编码已存在" });
    }
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 删除角色
 * DELETE /roles/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: -1, msg: "角色ID不合法" });

    await deleteRole(id);
    res.json({ code: 0, msg: "删除角色成功" });
  } catch (err) {
    console.error("删除角色失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 查询全量菜单树（授权弹窗的数据源，平铺列表）
 * GET /roles/menus/tree
 * 注意：必须放在 /:id/menus 之前，否则 "menus" 会被匹配为 :id
 */
router.get("/menus/tree", async (req, res) => {
  try {
    const list = await getAllMenus();
    res.json({ code: 0, data: { list } });
  } catch (err) {
    console.error("查询菜单树失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 查询角色的菜单授权（menu_id 集合）
 * GET /roles/:id/menus
 */
router.get("/:id/menus", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: -1, msg: "角色ID不合法" });

    const menuIds = await getRoleMenuIds(id);
    res.json({ code: 0, data: { menuIds } });
  } catch (err) {
    console.error("查询角色授权失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 保存角色菜单授权（全量覆盖）
 * PUT /roles/:id/menus  body: { menuIds: number[] }
 */
router.put("/:id/menus", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: -1, msg: "角色ID不合法" });

    const { menuIds = [] } = req.body;
    if (!Array.isArray(menuIds)) {
      return res.status(400).json({ code: -1, msg: "授权菜单格式不合法" });
    }

    await saveRoleMenus(id, menuIds);
    res.json({ code: 0, msg: "保存授权成功" });
  } catch (err) {
    console.error("保存角色授权失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

module.exports = router;
