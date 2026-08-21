// 动态菜单相关的类型定义

/** 后端下发的菜单项（平铺结构） */
export interface MenuItem {
  menuId: number;
  parentId: number;
  menuName: string;
  /** 菜单类型：0-目录，1-菜单，2-按钮 */
  menuType: number;
  /** 路由地址（如 /roleManage） */
  path: string;
  /** 组件相对路径（如 roleManage/index），目录/按钮可空 */
  component?: string;
  /** 权限标识（按钮节点，如 role:add） */
  perms?: string | null;
  /** 图标名（Element Plus 图标名） */
  icon?: string;
  /** 排序号 */
  orderNum?: number;
  /** 是否 iframe 嵌入 */
  isIframe?: number;
  /** 状态：0-正常 1-停用 */
  status?: number;
  children?: MenuItem[];
}
