-- ============================================
-- RBAC 改造脚本：用户表扩展、菜单表加 component、关联表
-- 数据库：test_db
-- 说明：增量改造，不 DROP 现有数据表
-- ============================================

-- 1. 扩展 user 表：登录账号 + 密码哈希 + 状态
ALTER TABLE `user`
  ADD COLUMN `account`  VARCHAR(50)  DEFAULT NULL COMMENT '登录账号（唯一）' AFTER `username`,
  ADD COLUMN `password` VARCHAR(255) DEFAULT NULL COMMENT '密码哈希（scrypt，格式 salt:hash，约161字符）' AFTER `account`,
  ADD COLUMN `status`   TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '状态：1-启用 0-禁用' AFTER `work_location`,
  ADD UNIQUE KEY `uk_account` (`account`);

-- 2. 扩展 sys_menu 表：组件路径（用于前端动态路由）
ALTER TABLE `sys_menu`
  ADD COLUMN `component` VARCHAR(200) DEFAULT '' COMMENT '组件相对路径（如 roleManage/index），目录/按钮可空' AFTER `path`;

-- 3. 用户-角色关联表（多对多）
CREATE TABLE IF NOT EXISTS `sys_user_role` (
  `user_id`     INT       NOT NULL COMMENT '用户ID（user.id）',
  `role_id`     INT       NOT NULL COMMENT '角色ID（role.role_id）',
  `create_time` DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`user_id`, `role_id`),
  KEY `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户-角色关联表';

-- 4. 角色-菜单关联表（多对多，含按钮级授权）
CREATE TABLE IF NOT EXISTS `sys_role_menu` (
  `role_id`     INT       NOT NULL COMMENT '角色ID（role.role_id）',
  `menu_id`     BIGINT(20) NOT NULL COMMENT '菜单ID（sys_menu.menu_id）',
  `create_time` DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`role_id`, `menu_id`),
  KEY `idx_menu_id` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色-菜单关联表';
