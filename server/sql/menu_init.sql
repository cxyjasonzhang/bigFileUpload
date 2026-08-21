-- ----------------------------
-- 菜单权限表（含排序字段）
-- ----------------------------
CREATE TABLE `sys_menu` (
  `menu_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '菜单ID（主键）',
  `parent_id` bigint(20) NOT NULL DEFAULT 0 COMMENT '父菜单ID，顶级菜单为0',
  `menu_name` varchar(50) NOT NULL COMMENT '菜单名称',
  `menu_type` tinyint(4) NOT NULL DEFAULT 0 COMMENT '菜单类型：0-目录，1-菜单，2-按钮',
  `path` varchar(200) DEFAULT '' COMMENT '路由地址（菜单或目录的URL）',
  `perms` varchar(500) DEFAULT NULL COMMENT '权限标识，如 sys:user:add，用于按钮级权限控制',
  `icon` varchar(100) DEFAULT '#' COMMENT '菜单图标（图标类名或URL）',
  `order_num` int(11) NOT NULL DEFAULT 0 COMMENT '排序号，数值越小越靠前',
  `is_iframe` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否为iframe嵌入：0-否，1-是',
  `status` tinyint(4) NOT NULL DEFAULT 0 COMMENT '状态：0-正常，1-停用',
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0 COMMENT '软删除标记：0-未删除，1-已删除',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`menu_id`) USING BTREE,
  KEY `idx_parent_id` (`parent_id`) USING BTREE COMMENT '父菜单索引，加速树形查询',
  KEY `idx_perms` (`perms`) USING BTREE COMMENT '权限标识索引，加速权限校验'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单权限表，存储目录、菜单和按钮信息';