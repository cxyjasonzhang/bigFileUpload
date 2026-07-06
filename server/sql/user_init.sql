-- ============================================
-- 用户表建表语句 + 10条初始数据
-- 数据库：MySQL97
-- ============================================

-- 删除旧表（如果存在）
DROP TABLE IF EXISTS `user`;

-- 建表
CREATE TABLE `user` (
  `id`            INT           NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
  `username`      VARCHAR(50)   NOT NULL                 COMMENT '姓名',
  `phone`         VARCHAR(11)   NOT NULL                 COMMENT '手机号',
  `home_address`  VARCHAR(200)  DEFAULT NULL             COMMENT '家庭住址',
  `work_location` VARCHAR(200)  DEFAULT NULL             COMMENT '工作地点',
  PRIMARY KEY (`id`),
  KEY `idx_username` (`username`),
  KEY `idx_phone`    (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 插入10条初始数据
INSERT INTO `user` (`username`, `phone`, `home_address`, `work_location`) VALUES
('王伟',   '13812345678', '北京市朝阳区中山路88号',    '北京市朝阳区腾讯大厦'),
('李芳',   '13923456789', '上海市浦东新区南京路12号',   '上海市浦东新区阿里中心'),
('张强',   '13634567890', '广州市天河区解放路56号',    '广州市天河区网易大厦'),
('刘娜',   '13745678901', '深圳市南山区滨海大道99号',   '深圳市南山区华为基地'),
('陈磊',   '15056789012', '杭州市西湖区科技路33号',    '杭州市滨江区字节跳动总部'),
('杨静',   '15167890123', '成都市武侯区天府大道77号',   '成都市高新区小米科技园'),
('黄洋',   '15278901234', '武汉市洪山区文化路45号',    '武汉市洪山区百度大厦'),
('赵敏',   '15889012345', '南京市鼓楼区和平路120号',   '南京市江宁区中兴通讯大厦'),
('周波',   '15990123456', '北京市海淀区长安街66号',    '北京市海淀区中关村软件园'),
('吴丽',   '18601234567', '上海市徐汇区人民路18号',    '上海市张江高科技园区联想总部');
