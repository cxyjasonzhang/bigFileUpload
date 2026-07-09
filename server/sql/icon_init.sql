-- ============================================
-- SVG 图标管理系统建表脚本
-- 数据库：test_db
-- 引擎：InnoDB
-- 字符集：utf8mb4
-- ============================================

-- 删除旧表（如果存在，先删子表再删父表）
DROP TABLE IF EXISTS `icons`;
DROP TABLE IF EXISTS `icon_groups`;

-- 图标分组表
CREATE TABLE `icon_groups` (
  `id`          INT           NOT NULL AUTO_INCREMENT  COMMENT '分组ID',
  `name`        VARCHAR(100)  NOT NULL                 COMMENT '分组显示名称',
  `slug`        VARCHAR(100)  NOT NULL                 COMMENT '分组标识（用于URL路径，仅允许小写字母、数字、短横线）',
  `description` VARCHAR(255)  DEFAULT NULL             COMMENT '分组描述',
  `sort_order`  INT           NOT NULL DEFAULT 0       COMMENT '排序权重',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图标分组表';

-- SVG 图标表
CREATE TABLE `icons` (
  `id`          INT           NOT NULL AUTO_INCREMENT  COMMENT '图标ID',
  `name`        VARCHAR(100)  NOT NULL                 COMMENT '图标名称',
  `group_id`    INT           NOT NULL                 COMMENT '所属分组ID',
  `description` VARCHAR(255)  DEFAULT NULL             COMMENT '图标描述',
  `svg_content` TEXT          NOT NULL                 COMMENT 'SVG完整内容',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name_group` (`name`, `group_id`),
  KEY `idx_group_id` (`group_id`),
  CONSTRAINT `fk_icons_group` FOREIGN KEY (`group_id`) REFERENCES `icon_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SVG图标表';
