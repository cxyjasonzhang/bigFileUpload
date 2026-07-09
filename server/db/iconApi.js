// iconApi.js - SVG图标管理系统数据库操作层

const connection = require('./db')

// ─── 图标版本号（三级缓存 B 方案依赖） ─────────────
// 任何图标变更都 +1，供前端启动时比对缓存失效。
const bumpIconVersion = () => {
  return new Promise((resolve) => {
    connection.query(
      'INSERT INTO app_meta (`key`, value) VALUES ("icon_version", 1) ON DUPLICATE KEY UPDATE value = value + 1',
      (err) => {
        // 即使版本号更新失败，也不影响主流程（缓存失效会降级）
        if (err) console.error('更新图标版本号失败:', err.message)
        resolve()
      }
    )
  })
}

// ─── 分组操作 ─────────────────────────────────────────

/**
 * 获取分组列表（含每个分组下的图标数量）
 */
const getGroups = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT g.id, g.name, g.slug, g.description, g.sort_order AS sortOrder,
             g.created_at AS createdAt, g.updated_at AS updatedAt,
             COUNT(i.id) AS iconCount
      FROM icon_groups g
      LEFT JOIN icons i ON i.group_id = g.id
      GROUP BY g.id, g.name, g.slug, g.description, g.sort_order, g.created_at, g.updated_at
      ORDER BY g.sort_order ASC, g.id ASC
    `
    connection.query(sql, (err, data) => {
      if (err) return reject(err)
      resolve(data)
    })
  })
}

/**
 * 获取单个分组详情
 * @param {number} id
 */
const getGroupById = (id) => {
  return new Promise((resolve, reject) => {
    connection.query('SELECT * FROM icon_groups WHERE id = ?', [id], (err, data) => {
      if (err) return reject(err)
      resolve(data[0] || null)
    })
  })
}

/**
 * 创建分组
 * @param {object} data - { name, slug, description, sortOrder }
 */
const createGroup = ({ name, slug, description, sortOrder = 0 }) => {
  return new Promise((resolve, reject) => {
    connection.query(
      'INSERT INTO icon_groups (name, slug, description, sort_order) VALUES (?, ?, ?, ?)',
      [name, slug, description || null, sortOrder],
      (err, data) => {
        if (err) return reject(err)
        resolve({ id: data.insertId })
      }
    )
  })
}

/**
 * 更新分组
 * @param {number} id
 * @param {object} data - { name, slug, description, sortOrder }
 */
const updateGroup = (id, { name, slug, description, sortOrder }) => {
  return new Promise((resolve, reject) => {
    connection.query(
      'UPDATE icon_groups SET name = ?, slug = ?, description = ?, sort_order = ? WHERE id = ?',
      [name, slug, description || null, sortOrder || 0, id],
      (err, data) => {
        if (err) return reject(err)
        resolve(data)
      }
    )
  })
}

/**
 * 删除分组（级联删除图标由数据库 ON DELETE CASCADE 处理）
 * @param {number} id
 */
const deleteGroup = (id) => {
  return new Promise((resolve, reject) => {
    connection.query('DELETE FROM icon_groups WHERE id = ?', [id], (err, data) => {
      if (err) return reject(err)
      resolve(data)
    })
  })
}

// ─── 图标操作 ─────────────────────────────────────────

/**
 * 获取图标列表（支持分组过滤、关键词搜索、分页）
 * @param {object} filters - { groupId, keyword, page, pageSize }
 */
const getIcons = ({ groupId, keyword, page = 1, pageSize = 24 }) => {
  return new Promise((resolve, reject) => {
    const conditions = []
    const params = []

    if (groupId) {
      conditions.push('i.group_id = ?')
      params.push(groupId)
    }
    if (keyword) {
      conditions.push('i.name LIKE ?')
      params.push(`%${keyword}%`)
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    // 先查总数
    const countSQL = `SELECT COUNT(*) AS total FROM icons i ${whereClause}`
    connection.query(countSQL, params, (err, countResult) => {
      if (err) return reject(err)

      const total = countResult[0]?.total || 0

      // 再查分页数据
      const dataSQL = `
        SELECT i.id, i.name, i.group_id AS groupId, i.description,
               i.svg_content AS svgContent,
               i.created_at AS createdAt, i.updated_at AS updatedAt,
               g.name AS groupName, g.slug AS groupSlug
        FROM icons i
        LEFT JOIN icon_groups g ON g.id = i.group_id
        ${whereClause}
        ORDER BY i.updated_at DESC, i.id DESC
        LIMIT ? OFFSET ?
      `
      const offset = (page - 1) * pageSize
      const dataParams = [...params, pageSize, offset]

      connection.query(dataSQL, dataParams, (e, list) => {
        if (e) return reject(e)
        resolve({ list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
      })
    })
  })
}

/**
 * 获取单个图标详情
 * @param {number} id
 */
const getIconById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT i.*, g.name AS groupName, g.slug AS groupSlug
      FROM icons i
      LEFT JOIN icon_groups g ON g.id = i.group_id
      WHERE i.id = ?
    `
    connection.query(sql, [id], (err, data) => {
      if (err) return reject(err)
      resolve(data[0] || null)
    })
  })
}

/**
 * 解析图标：通过分组slug + 图标名返回SVG内容
 * @param {string} groupSlug - 分组标识
 * @param {string} iconName - 图标名称
 */
const resolveIcon = (groupSlug, iconName) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT i.svg_content AS svgContent
      FROM icons i
      JOIN icon_groups g ON g.id = i.group_id
      WHERE g.slug = ? AND i.name = ?
    `
    connection.query(sql, [groupSlug, iconName], (err, data) => {
      if (err) return reject(err)
      resolve(data[0] || null)
    })
  })
}

/**
 * 获取当前图标版本号（三级缓存 B 方案：前端启动比对）
 */
const getIconVersion = () => {
  return new Promise((resolve, reject) => {
    connection.query(
      'SELECT value FROM app_meta WHERE `key` = "icon_version"',
      (err, data) => {
        if (err) return reject(err)
        resolve(data[0]?.value ?? 0)
      }
    )
  })
}

/**
 * 新增单个图标
 * @param {object} data - { name, groupId, description, svgContent }
 */
const createIcon = ({ name, groupId, description, svgContent }) => {
  return new Promise((resolve, reject) => {
    connection.query(
      'INSERT INTO icons (name, group_id, description, svg_content) VALUES (?, ?, ?, ?)',
      [name, groupId, description || null, svgContent],
      async (err, data) => {
        if (err) return reject(err)
        await bumpIconVersion()
        resolve({ id: data.insertId })
      }
    )
  })
}

/**
 * 批量导入图标（使用事务保证原子性）
 * @param {number} groupId - 目标分组ID
 * @param {Array<{name, description, svgContent}>} icons - 图标数据数组
 */
const batchCreateIcons = (groupId, icons) => {
  return new Promise((resolve, reject) => {
    connection.beginTransaction((err) => {
      if (err) return reject(err)

      const values = icons.map(({ name, description, svgContent }) => [
        name, groupId, description || null, svgContent
      ])

      const sql = 'INSERT INTO icons (name, group_id, description, svg_content) VALUES ?'
      connection.query(sql, [values], (e, data) => {
        if (e) {
          return connection.rollback(() => reject(e))
        }
        connection.commit(async (commitErr) => {
          if (commitErr) {
            return connection.rollback(() => reject(commitErr))
          }
          await bumpIconVersion()
          resolve({ count: data.affectedRows })
        })
      })
    })
  })
}

/**
 * 更新图标
 * @param {number} id
 * @param {object} data - { name, groupId, description, svgContent }
 */
const updateIcon = (id, { name, groupId, description, svgContent }) => {
  return new Promise((resolve, reject) => {
    connection.query(
      'UPDATE icons SET name = ?, group_id = ?, description = ?, svg_content = ? WHERE id = ?',
      [name, groupId, description || null, svgContent, id],
      async (err, data) => {
        if (err) return reject(err)
        await bumpIconVersion()
        resolve(data)
      }
    )
  })
}

/**
 * 删除单个图标
 * @param {number} id
 */
const deleteIcon = (id) => {
  return new Promise((resolve, reject) => {
    connection.query('DELETE FROM icons WHERE id = ?', [id], async (err, data) => {
      if (err) return reject(err)
      await bumpIconVersion()
      resolve(data)
    })
  })
}

/**
 * 批量删除图标
 * @param {number[]} ids
 */
const batchDeleteIcons = (ids) => {
  return new Promise((resolve, reject) => {
    if (!ids || ids.length === 0) {
      return resolve({ count: 0 })
    }
    const placeholders = ids.map(() => '?').join(',')
    connection.query(`DELETE FROM icons WHERE id IN (${placeholders})`, ids, async (err, data) => {
      if (err) return reject(err)
      await bumpIconVersion()
      resolve({ count: data.affectedRows })
    })
  })
}

/**
 * 根据分组ID获取该分组下所有图标名称列表（用于重复检测）
 * @param {number} groupId
 */
const getIconNamesByGroup = (groupId) => {
  return new Promise((resolve, reject) => {
    connection.query('SELECT name FROM icons WHERE group_id = ?', [groupId], (err, data) => {
      if (err) return reject(err)
      resolve(data.map(row => row.name))
    })
  })
}

module.exports = {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getIcons,
  getIconById,
  resolveIcon,
  getIconVersion,
  createIcon,
  batchCreateIcons,
  updateIcon,
  deleteIcon,
  batchDeleteIcons,
  getIconNamesByGroup,
}
