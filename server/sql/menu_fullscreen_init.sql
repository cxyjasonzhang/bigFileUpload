-- ============================================
-- 菜单表增加「是否全屏」字段
-- 数据库：test_db
-- 说明：增量改造，不 DROP 现有数据表
-- 全屏语义：菜单打开时隐藏侧边栏/顶栏/Tab，内容区整页独立展示（区别于 is_iframe 内嵌）
-- ============================================

ALTER TABLE `sys_menu`
  ADD COLUMN `is_full_screen` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否全屏展示：0-否，1-是（仅菜单类型有效）' AFTER `is_iframe`;
