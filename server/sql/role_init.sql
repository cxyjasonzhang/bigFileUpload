-- ============================================
-- 角色表建表语句 + 10条初始数据
-- 数据库：test_db
-- 引擎：InnoDB
-- 字符集：utf8mb4
-- ============================================

-- 删除旧表（如果存在）
DROP TABLE IF EXISTS `role`;

-- 建表
CREATE TABLE `role` (
  `role_id`     INT           NOT NULL AUTO_INCREMENT  COMMENT '角色ID',
  `role_name`   VARCHAR(50)   NOT NULL                 COMMENT '角色名称',
  `role_code`   VARCHAR(50)   NOT NULL                 COMMENT '角色编码',
  `description` VARCHAR(255)  DEFAULT NULL             COMMENT '描述',
  `enabled`     TINYINT(1)    NOT NULL DEFAULT 1       COMMENT '是否启用（1-启用 0-禁用）',
  `create_time` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `uk_role_code` (`role_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- 插入10条初始数据
INSERT INTO `role` (`role_name`, `role_code`, `description`, `enabled`) VALUES
('超级管理员',   'R_SUPER',      '拥有系统全部权限',     1),
('管理员',       'R_ADMIN',      '拥有系统管理权限',     1),
('普通用户',     'R_USER',       '拥有系统普通权限',     1),
('财务管理员',   'R_FINANCE',    '管理财务相关权限',     1),
('数据分析师',   'R_ANALYST',    '拥有数据分析权限',     0),
('客服专员',     'R_SUPPORT',    '处理客户支持请求',     1),
('营销经理',     'R_MARKETING',  '管理营销活动权限',     1),
('访客用户',     'R_GUEST',      '仅限浏览权限',         0),
('系统维护员',   'R_MAINTAINER', '负责系统维护和更新',   1),
('项目经理',     'R_PM',         '管理项目相关权限',     1);
