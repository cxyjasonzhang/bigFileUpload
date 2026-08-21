// 菜单管理 — 数据库操作（全量查询、新增、编辑、软删除、同级排序）

const connection = require("./db");

// 列表查询公共字段（AS 别名转驼峰）
const MENU_COLUMNS = `
  menu_id AS menuId,
  parent_id AS parentId,
  menu_name AS menuName,
  menu_type AS menuType,
  path,
  component,
  perms,
  icon,
  order_num AS orderNum,
  is_iframe AS isIframe,
  status,
  is_deleted AS isDeleted,
  create_time AS createTime
`;

/**
 * 查询全部菜单（平铺列表，已过滤软删除）
 * @returns {Promise<Array>}
 */
const getMenuList = () => {
  return new Promise((resolve, reject) => {
    connection.query(
      `SELECT ${MENU_COLUMNS}
       FROM sys_menu
       WHERE is_deleted = 0
       ORDER BY order_num ASC, menu_id ASC`,
      (err, list) => {
        if (err) return reject(err);
        resolve(list);
      }
    );
  });
};

/**
 * 根据 ID 查询单个菜单
 * @param {number} id - menu_id
 * @returns {Promise<object|null>}
 */
const getMenuById = (id) => {
  return new Promise((resolve, reject) => {
    connection.query(
      `SELECT ${MENU_COLUMNS} FROM sys_menu WHERE menu_id = ?`,
      [id],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0] || null);
      }
    );
  });
};

/**
 * 新增菜单
 * @param {object} param - { parentId, menuName, menuType, path, component, perms, icon, orderNum, isIframe, status }
 */
const insertMenu = ({ parentId, menuName, menuType, path, component, perms, icon, orderNum, isIframe, status }) => {
  return new Promise((resolve, reject) => {
    connection.query(
      `INSERT INTO sys_menu
         (parent_id, menu_name, menu_type, path, component, perms, icon, order_num, is_iframe, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [parentId, menuName, menuType, path || "", component || "", perms || null, icon || "", orderNum, isIframe, status],
      (err, data) => {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
};

/**
 * 编辑菜单
 * @param {number} id - menu_id
 * @param {object} param - 同 insertMenu
 */
const updateMenu = (id, { parentId, menuName, menuType, path, component, perms, icon, orderNum, isIframe, status }) => {
  return new Promise((resolve, reject) => {
    connection.query(
      `UPDATE sys_menu
       SET parent_id = ?, menu_name = ?, menu_type = ?, path = ?, component = ?, perms = ?, icon = ?, order_num = ?, is_iframe = ?, status = ?
       WHERE menu_id = ? AND is_deleted = 0`,
      [parentId, menuName, menuType, path || "", component || "", perms || null, icon || "", orderNum, isIframe, status, id],
      (err, data) => {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
};

/**
 * 软删除菜单（is_deleted 置 1，不物理删除）
 * @param {number} id - menu_id
 */
const softDeleteMenu = (id) => {
  return new Promise((resolve, reject) => {
    connection.query(
      "UPDATE sys_menu SET is_deleted = 1 WHERE menu_id = ? AND is_deleted = 0",
      [id],
      (err, data) => {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
};

/**
 * 统计某菜单下的直接子节点数量（未删除）
 * @param {number} parentId - 父菜单 ID
 * @returns {Promise<number>}
 */
const countChildren = (parentId) => {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT COUNT(*) AS total FROM sys_menu WHERE parent_id = ? AND is_deleted = 0",
      [parentId],
      (err, result) => {
        if (err) return reject(err);
        resolve(result[0]?.total || 0);
      }
    );
  });
};

/**
 * 递归收集某菜单的所有子孙 ID
 * @param {number} id - menu_id
 * @returns {Promise<Array<number>>}
 */
const getDescendantIds = (id) => {
  const collect = (list, currentId, acc) => {
    const children = list.filter((item) => item.parentId === currentId);
    children.forEach((child) => {
      acc.push(child.menuId);
      collect(list, child.menuId, acc);
    });
    return acc;
  };
  return getMenuList().then((list) => collect(list, id, []));
};

/**
 * 查询某菜单的同级兄弟列表（不含自己，含已按 order_num 排序）
 * @param {number} parentId - 父菜单 ID
 * @param {number} excludeId - 排除的菜单 ID（自己）
 * @returns {Promise<Array>}
 */
const getSiblings = (parentId, excludeId) => {
  return new Promise((resolve, reject) => {
    connection.query(
      `SELECT menu_id AS menuId, order_num AS orderNum
       FROM sys_menu
       WHERE parent_id = ? AND is_deleted = 0 AND menu_id != ?
       ORDER BY order_num ASC, menu_id ASC`,
      [parentId, excludeId],
      (err, list) => {
        if (err) return reject(err);
        resolve(list);
      }
    );
  });
};

/**
 * 交换两个菜单的排序号
 * 排序号相同时通过 ±1 偏移打破平局，保证移动方向生效
 * @param {number} idA - 当前菜单 ID
 * @param {number} idB - 目标菜单 ID
 * @param {number} orderNumA - 当前菜单原排序号
 * @param {number} orderNumB - 目标菜单排序号
 * @param {'up'|'down'} direction - 移动方向
 */
const swapOrderNum = (idA, idB, orderNumA, orderNumB, direction) => {
  return new Promise((resolve, reject) => {
    let nextA = orderNumB;
    let nextB = orderNumA;
    if (orderNumA === orderNumB) {
      // 排序号相同则直接交换无效，用偏移打破平局：
      // 上移时 A 排到 B 前（A 更小），下移时 A 排到 B 后（A 更大）
      nextA = orderNumA + (direction === "up" ? -1 : 1);
      nextB = orderNumB + (direction === "up" ? 1 : -1);
    }
    // 先改 A 再改 B，避免相同值时覆盖丢失
    connection.query("UPDATE sys_menu SET order_num = ? WHERE menu_id = ?", [nextA, idA], (err) => {
      if (err) return reject(err);
      connection.query("UPDATE sys_menu SET order_num = ? WHERE menu_id = ?", [nextB, idB], (err2) => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
};

module.exports = {
  getMenuList,
  getMenuById,
  insertMenu,
  updateMenu,
  softDeleteMenu,
  countChildren,
  getDescendantIds,
  getSiblings,
  swapOrderNum,
};
