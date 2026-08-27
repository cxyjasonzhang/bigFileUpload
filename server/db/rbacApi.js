// RBAC 数据层：用户-角色、角色-菜单查询 + 权限聚合

const connection = require("./db");

/** 查询结果转 Promise */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

// 超级管理员角色编码
const SUPER_ROLE_CODE = "R_SUPER";

/**
 * 根据账号查询用户（含密码哈希）
 * @param {string} account 登录账号
 * @returns {Promise<object|null>}
 */
const getUserByAccount = (account) => {
  return new Promise((resolve, reject) => {
    connection.query(
      `SELECT id, username, account, password, phone, status
       FROM \`user\`
       WHERE account = ? LIMIT 1`,
      [account],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0] || null);
      }
    );
  });
};

/**
 * 查询用户拥有的角色编码列表
 * @param {number} userId 用户 ID
 * @returns {Promise<Array<string>>}
 */
const getUserRoleCodes = (userId) => {
  return new Promise((resolve, reject) => {
    connection.query(
      `SELECT r.role_code AS roleCode
       FROM \`role\` r
       JOIN sys_user_role ur ON ur.role_id = r.role_id
       WHERE ur.user_id = ? AND r.enabled = 1`,
      [userId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map((r) => r.roleCode));
      }
    );
  });
};

/**
 * 判断用户是否为超级管理员（拥有 R_SUPER 角色）
 * @param {number} userId 用户 ID
 * @returns {Promise<boolean>}
 */
const isSuperAdmin = (userId) => {
  return new Promise((resolve, reject) => {
    connection.query(
      `SELECT COUNT(*) AS total
       FROM sys_user_role ur
       JOIN \`role\` r ON r.role_id = ur.role_id
       WHERE ur.user_id = ? AND r.role_code = ? AND r.enabled = 1`,
      [userId, SUPER_ROLE_CODE],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0]?.total > 0);
      }
    );
  });
};

/**
 * 查询用户有权限的菜单（平铺，含目录/菜单/按钮）
 * @param {number} userId 用户 ID
 * @returns {Promise<Array>}
 */
const getUserMenus = (userId) => {
  return new Promise((resolve, reject) => {
    connection.query(
      `SELECT DISTINCT m.menu_id AS menuId,
             m.parent_id AS parentId,
             m.menu_name AS menuName,
             m.menu_type AS menuType,
             m.path,
             m.component,
             m.perms,
             m.icon,
             m.order_num AS orderNum,
             m.is_iframe AS isIframe,
             m.is_full_screen AS isFullScreen,
             m.status
       FROM sys_menu m
       JOIN sys_role_menu rm ON rm.menu_id = m.menu_id
       JOIN sys_user_role ur ON ur.role_id = rm.role_id
       JOIN \`role\` r ON r.role_id = ur.role_id
       WHERE ur.user_id = ? AND r.enabled = 1 AND m.is_deleted = 0 AND m.status = 0
       ORDER BY m.order_num ASC, m.menu_id ASC`,
      [userId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
};

/**
 * 查询全量菜单（平铺，超级管理员专用）
 * @returns {Promise<Array>}
 */
const getAllMenus = () => {
  return new Promise((resolve, reject) => {
    connection.query(
      `SELECT menu_id AS menuId,
             parent_id AS parentId,
             menu_name AS menuName,
             menu_type AS menuType,
             path,
             component,
             perms,
             icon,
             order_num AS orderNum,
             is_iframe AS isIframe,
             is_full_screen AS isFullScreen,
             status
       FROM sys_menu
       WHERE is_deleted = 0 AND status = 0
       ORDER BY order_num ASC, menu_id ASC`,
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
};

/**
 * 查询角色的菜单授权（menu_id 集合）
 * @param {number} roleId 角色 ID
 * @returns {Promise<Array<number>>}
 */
const getRoleMenuIds = (roleId) => {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT menu_id AS menuId FROM sys_role_menu WHERE role_id = ?",
      [roleId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map((r) => r.menuId));
      }
    );
  });
};

/**
 * 保存角色菜单授权（先清空再批量插入）
 * @param {number} roleId 角色 ID
 * @param {Array<number>} menuIds 菜单 ID 集合
 */
const saveRoleMenus = async (roleId, menuIds) => {
  await query("DELETE FROM sys_role_menu WHERE role_id = ?", [roleId]);
  if (menuIds && menuIds.length) {
    for (const menuId of menuIds) {
      await query(
        "INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (?, ?)",
        [roleId, menuId]
      );
    }
  }
};

module.exports = {
  SUPER_ROLE_CODE,
  getUserByAccount,
  getUserRoleCodes,
  isSuperAdmin,
  getUserMenus,
  getAllMenus,
  getRoleMenuIds,
  saveRoleMenus,
};
