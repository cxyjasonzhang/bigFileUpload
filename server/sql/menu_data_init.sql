-- ============================================
-- 菜单初始数据：对应前端静态 menuConfig 的 7 个页面
-- 说明：menu_type 0-目录 1-菜单 2-按钮
-- ============================================

-- 清空旧菜单数据（重新初始化）
DELETE FROM `sys_menu`;

-- 顶级菜单（parent_id = 0）
INSERT INTO `sys_menu`
  (`menu_id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `perms`, `icon`, `order_num`, `is_iframe`, `status`) VALUES
  (1, 0, '工作台',   1, '/workbench', 'workbench/index',  NULL, 'Odometer',     1, 0, 0),
  (2, 0, '文件上传', 1, '/upload',    'fileUpload/index', NULL, 'UploadFilled', 2, 0, 0),
  (3, 0, '用户管理', 1, '/users',     'userManagement/index', NULL, 'User',      3, 0, 0),
  (4, 0, '图标管理', 1, '/icons',     'iconManager/index',    NULL, 'Picture',   4, 0, 0),
  (5, 0, '流程管理', 1, '/workflow',  'workflow/index',       NULL, 'User',      5, 0, 0),
  (6, 0, '角色管理', 1, '/roleManage','roleManage/index',     NULL, 'User',      6, 0, 0),
  (7, 0, '菜单管理', 1, '/menuManage','menuManage/index',     NULL, 'Menu',      7, 0, 0);
