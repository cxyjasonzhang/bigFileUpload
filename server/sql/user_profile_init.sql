-- ============================================
-- 个人中心：user 表新增资料字段
-- 说明：昵称、性别、邮箱、个人介绍为新增字段；
--       姓名复用 username、手机复用 phone、联系地址复用 home_address
-- ============================================

ALTER TABLE `user`
  ADD COLUMN `nickname` VARCHAR(50)  DEFAULT NULL COMMENT '昵称（显示名）' AFTER `username`,
  ADD COLUMN `gender`   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '性别：0-未设置 1-男 2-女' AFTER `phone`,
  ADD COLUMN `email`    VARCHAR(100) DEFAULT NULL COMMENT '邮箱' AFTER `gender`,
  ADD COLUMN `bio`      VARCHAR(500) DEFAULT NULL COMMENT '个人介绍' AFTER `email`;
