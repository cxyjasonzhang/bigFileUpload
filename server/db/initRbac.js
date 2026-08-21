// RBAC 一次性初始化脚本：生成密码哈希 + 创建管理员账号 + 挂载超级管理员角色
// 用法：在 server 目录下执行  node db/initRbac.js
// 说明：需先执行 sql/rbac_init.sql（结构改造）与 sql/menu_data_init.sql（菜单初始数据）

const crypto = require("crypto");
const connection = require("./db");

const ADMIN_PASSWORD = "admin123"; // 默认管理员密码
const DEFAULT_USER_PASSWORD = "123456"; // 存量用户的默认密码

/**
 * 使用 node 原生 scrypt 生成密码哈希
 * 格式：salt:hash（均为 hex）
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** 校验密码（供登录模块复用，这里仅验证生成的哈希可校验） */
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

/** 执行 SQL 查询（Promise 化） */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

(async () => {
  try {
    // 1. 创建超级管理员账号（admin / admin123），挂 R_SUPER 角色
    const adminHash = hashPassword(ADMIN_PASSWORD);
    await query(
      "INSERT INTO `user` (username, account, password, phone, status) VALUES (?, ?, ?, ?, ?)",
      ["管理员", "admin", adminHash, "13800000000", 1]
    );
    const adminRows = await query("SELECT id FROM `user` WHERE account = 'admin' LIMIT 1");
    const adminId = adminRows[0].id;

    const superRole = await query("SELECT role_id FROM `role` WHERE role_code = 'R_SUPER' LIMIT 1");
    if (superRole.length) {
      await query(
        "INSERT IGNORE INTO `sys_user_role` (user_id, role_id) VALUES (?, ?)",
        [adminId, superRole[0].role_id]
      );
    }

    // 2. 存量用户补账号（= 手机号）与默认密码
    const users = await query("SELECT id, phone, account FROM `user` WHERE account IS NULL");
    for (const u of users) {
      const hash = hashPassword(DEFAULT_USER_PASSWORD);
      await query("UPDATE `user` SET account = ?, password = ? WHERE id = ?", [
        u.phone,
        hash,
        u.id,
      ]);
    }

    console.log("✅ RBAC 初始化完成：");
    console.log(`   - 超级管理员账号：admin / ${ADMIN_PASSWORD}`);
    console.log(`   - 存量用户 ${users.length} 个已补账号（=手机号）与默认密码 ${DEFAULT_USER_PASSWORD}`);

    // 验证哈希可校验
    const check = verifyPassword(ADMIN_PASSWORD, adminHash);
    console.log(`   - 密码哈希自检：${check ? "通过" : "失败"}`);

    connection.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ RBAC 初始化失败：", err);
    connection.end();
    process.exit(1);
  }
})();
