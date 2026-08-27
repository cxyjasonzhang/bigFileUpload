// 菜单管理路由 — 树形菜单 CRUD + 同级排序

const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const {
  getMenuList,
  getMenuById,
  insertMenu,
  updateMenu,
  softDeleteMenu,
  countChildren,
  getDescendantIds,
  getSiblings,
  swapOrderNum,
} = require("../db/menuApi");

const router = express.Router();

// 所有菜单接口需登录
router.use(authMiddleware);

// 菜单类型白名单
const MENU_TYPES = [0, 1, 2];

/**
 * 校验菜单类型相关的必填字段
 * @returns {string|null} 错误信息，通过返回 null
 */
const validateMenuType = ({ menuType, menuName, path, component, perms }) => {
  // 字段可能为 null（数据库返回空值），统一转字符串后再校验
  const name = menuName || "";
  const pathStr = path || "";
  const componentStr = component || "";
  const permsStr = perms || "";
  if (!name.trim()) return "菜单名称不能为空";
  if (!MENU_TYPES.includes(menuType)) return "菜单类型不合法";
  // 菜单类型（1）必须配置路由地址
  if (menuType === 1 && !pathStr.trim()) return "菜单类型必须填写路由地址";
  // 菜单类型（1）必须配置组件地址（动态路由渲染组件依赖）
  if (menuType === 1 && !componentStr.trim()) return "菜单类型必须填写组件地址";
  // 按钮类型（2）必须配置权限标识
  if (menuType === 2 && !permsStr.trim()) return "按钮类型必须填写权限标识";
  return null;
};

/**
 * 校验父级是否合法（不能是自己/子孙/按钮节点），用于新增和编辑
 * @returns {Promise<string|null>} 错误信息，通过返回 null
 */
const validateParent = async (id, parentId) => {
  if (parentId === 0) return null;
  // 父级不能是自己
  if (parentId === id) return "父级菜单不能选择自己";
  // 父级不能是按钮类型（按钮节点不应有子级）
  const parent = await getMenuById(parentId);
  if (!parent) return "父级菜单不存在";
  if (parent.menuType === 2) return "按钮类型菜单不能作为父级";
  // 编辑时父级不能是当前菜单的子孙，防止循环引用
  if (id) {
    const descendants = await getDescendantIds(id);
    if (descendants.includes(parentId)) return "父级菜单不能是当前菜单的子级";
  }
  return null;
};

/**
 * 查询菜单列表（全量平铺，前端组装树）
 * GET /menus
 */
router.get("/", async (req, res) => {
  try {
    const list = await getMenuList();
    res.json({ code: 0, data: { list } });
  } catch (err) {
    console.error("查询菜单列表失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 新增菜单
 * POST /menus
 */
router.post("/", async (req, res) => {
  try {
    const {
      parentId = 0,
      menuName = "",
      menuType = 0,
      path = "",
      component = "",
      perms = "",
      icon = "",
      orderNum = 0,
      isIframe = 0,
      isFullScreen = 0,
      status = 0,
    } = req.body;

    const typeErr = validateMenuType({ menuType: Number(menuType), menuName, path, component, perms });
    if (typeErr) return res.status(400).json({ code: -1, msg: typeErr });

    const parentErr = await validateParent(null, Number(parentId));
    if (parentErr) return res.status(400).json({ code: -1, msg: parentErr });

    await insertMenu({
      parentId: Number(parentId),
      menuName: (menuName || "").trim(),
      menuType: Number(menuType),
      path: (path || "").trim(),
      component: (component || "").trim(),
      perms: (perms || "").trim() || null,
      icon: (icon || "").trim(),
      orderNum: Number(orderNum) || 0,
      isIframe: Number(isIframe) ? 1 : 0,
      isFullScreen: Number(isFullScreen) ? 1 : 0,
      status: Number(status) ? 1 : 0,
    });

    res.json({ code: 0, msg: "新增菜单成功" });
  } catch (err) {
    console.error("新增菜单失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 编辑菜单
 * PUT /menus/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: -1, msg: "菜单ID不合法" });

    const {
      parentId = 0,
      menuName = "",
      menuType = 0,
      path = "",
      component = "",
      perms = "",
      icon = "",
      orderNum = 0,
      isIframe = 0,
      isFullScreen = 0,
      status = 0,
    } = req.body;

    const typeErr = validateMenuType({ menuType: Number(menuType), menuName, path, component, perms });
    if (typeErr) return res.status(400).json({ code: -1, msg: typeErr });

    const parentErr = await validateParent(id, Number(parentId));
    if (parentErr) return res.status(400).json({ code: -1, msg: parentErr });

    await updateMenu(id, {
      parentId: Number(parentId),
      menuName: (menuName || "").trim(),
      menuType: Number(menuType),
      path: (path || "").trim(),
      component: (component || "").trim(),
      perms: (perms || "").trim() || null,
      icon: (icon || "").trim(),
      orderNum: Number(orderNum) || 0,
      isIframe: Number(isIframe) ? 1 : 0,
      isFullScreen: Number(isFullScreen) ? 1 : 0,
      status: Number(status) ? 1 : 0,
    });

    res.json({ code: 0, msg: "编辑菜单成功" });
  } catch (err) {
    console.error("编辑菜单失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 删除菜单（软删除，带子节点时禁止删除）
 * DELETE /menus/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: -1, msg: "菜单ID不合法" });

    const children = await countChildren(id);
    if (children > 0) {
      return res.status(400).json({ code: -1, msg: `该菜单下还有 ${children} 个子菜单，请先删除子级` });
    }

    const result = await softDeleteMenu(id);
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: -1, msg: "菜单不存在或已被删除" });
    }
    res.json({ code: 0, msg: "删除菜单成功" });
  } catch (err) {
    console.error("删除菜单失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

/**
 * 菜单上移/下移（仅与同级兄弟交换排序号）
 * PUT /menus/:id/move  body: { direction: 'up' | 'down' }
 */
router.put("/:id/move", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { direction } = req.body;
    if (!id) return res.status(400).json({ code: -1, msg: "菜单ID不合法" });
    if (!["up", "down"].includes(direction)) return res.status(400).json({ code: -1, msg: "移动方向不合法" });

    const menu = await getMenuById(id);
    if (!menu) return res.status(404).json({ code: -1, msg: "菜单不存在" });

    const siblings = await getSiblings(menu.parentId, id);
    // 同级全量（含自己）按 (order_num, menu_id) 排序，确定当前位置
    const all = [...siblings, { menuId: id, orderNum: menu.orderNum }].sort(
      (a, b) => a.orderNum - b.orderNum || a.menuId - b.menuId
    );
    const index = all.findIndex((item) => item.menuId === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= all.length) {
      return res.status(400).json({
        code: -1,
        msg: direction === "up" ? "当前菜单已在同级最前，无法上移" : "当前菜单已在同级最后，无法下移",
      });
    }

    const target = all[targetIndex];
    await swapOrderNum(id, target.menuId, menu.orderNum, target.orderNum, direction);
    res.json({ code: 0, msg: "排序调整成功" });
  } catch (err) {
    console.error("菜单排序调整失败:", err);
    res.status(500).json({ code: -1, msg: "服务器内部错误，请稍后重试" });
  }
});

module.exports = router;
