// 密码哈希工具：基于 node 原生 crypto.scrypt（无第三方依赖）

const crypto = require("crypto");

/**
 * 生成密码哈希
 * 格式：salt:hash（均为 hex）
 * @param {string} password 明文密码
 * @returns {string} 形如 "salt:hash" 的哈希串
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * 校验密码
 * @param {string} password 明文密码
 * @param {string} stored 数据库中存储的哈希串（salt:hash）
 * @returns {boolean} 是否匹配
 */
function verifyPassword(password, stored) {
  if (!password || !stored) return false;
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

module.exports = { hashPassword, verifyPassword };
