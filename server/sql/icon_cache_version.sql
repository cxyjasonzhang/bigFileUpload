-- ============================================
-- 图标缓存版本号表（三级缓存 B 方案依赖）
-- 数据库：test_db
-- 说明：任何图标变更（新增/更新/删除/批量）都会让 icon_version +1，
--       前端启动时比对版本号，不一致则清空本地缓存（L1+L2）。
--       注意：删除图标不会更新 icons.updated_at，因此必须用整数计数器，
--       不能用 MAX(updated_at) 作为版本号。
-- ============================================

CREATE TABLE IF NOT EXISTS `app_meta` (
  `key`   VARCHAR(100) NOT NULL COMMENT '配置键',
  `value` INT          NOT NULL DEFAULT 0 COMMENT '配置值',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='全局配置表';

-- 种子：版本号初始为 0
INSERT INTO `app_meta` (`key`, `value`) VALUES ('icon_version', 0)
ON DUPLICATE KEY UPDATE `value` = `value`;
