// 角色管理 — 数据库操作（分页查询、创建、编辑、删除）

const connection = require("./db");

/**
 * 查询角色列表（分页 + 搜索）
 * @param {object} params - { roleName?, roleCode?, enabled?, page, pageSize }
 * @returns {Promise<{list: Array, total: number}>}
 */
const getRoleList = ({ roleName, roleCode, enabled, page, pageSize }) => {
  return new Promise((resolve, reject) => {
    const conditions = [];
    const params = [];

    if (roleName) {
      conditions.push("role_name LIKE ?");
      params.push(`%${roleName}%`);
    }
    if (roleCode) {
      conditions.push("role_code LIKE ?");
      params.push(`%${roleCode}%`);
    }
    // enabled 精确匹配（0 禁用 / 1 启用）
    if (enabled === 0 || enabled === 1) {
      conditions.push("enabled = ?");
      params.push(enabled);
    }

    const whereClause = conditions.length > 0
      ? "WHERE " + conditions.join(" AND ")
      : "";

    // 1. 查总数
    const countSQL = `SELECT COUNT(*) AS total FROM \`role\` ${whereClause}`;
    connection.query(countSQL, params, (err, countResult) => {
      if (err) return reject(err);

      const total = countResult[0]?.total || 0;

      // 2. 查分页数据（AS 别名转驼峰）
      const dataSQL = `
        SELECT role_id AS roleId,
               role_name AS roleName,
               role_code AS roleCode,
               description,
               enabled,
               create_time AS createTime
        FROM \`role\`
        ${whereClause}
        ORDER BY role_id ASC
        LIMIT ? OFFSET ?
      `;

      const offset = (page - 1) * pageSize;
      const dataParams = [...params, pageSize, offset];

      connection.query(dataSQL, dataParams, (err, list) => {
        if (err) return reject(err);
        resolve({ list, total });
      });
    });
  });
};

/**
 * 创建角色
 * @param {object} param - { roleName, roleCode, description, enabled }
 */
const insertRole = ({ roleName, roleCode, description, enabled }) => {
  return new Promise((resolve, reject) => {
    connection.query(
      "INSERT INTO `role` (role_name, role_code, description, enabled) VALUES (?, ?, ?, ?)",
      [roleName, roleCode, description || null, enabled ?? 1],
      (err, data) => {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
};

/**
 * 编辑角色
 * @param {number} id - role_id
 * @param {object} param - { roleName, roleCode, description, enabled }
 */
const updateRole = (id, { roleName, roleCode, description, enabled }) => {
  return new Promise((resolve, reject) => {
    connection.query(
      "UPDATE `role` SET role_name = ?, role_code = ?, description = ?, enabled = ? WHERE role_id = ?",
      [roleName, roleCode, description || null, enabled ?? 1, id],
      (err, data) => {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
};

/**
 * 删除角色
 * @param {number} id - role_id
 */
const deleteRole = (id) => {
  return new Promise((resolve, reject) => {
    connection.query("DELETE FROM `role` WHERE role_id = ?", [id], (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
};

module.exports = {
  getRoleList,
  insertRole,
  updateRole,
  deleteRole,
};
