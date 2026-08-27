// 菜单实体类型 — 单一主类型源
// 后端下发的菜单为平铺结构（/menus、/auth/routes 均返回平铺列表），
// 前端按需组装成树（侧边栏/授权树/父级选择器）。此处作为菜单实体的唯一定义，
// 全局 Api 命名空间不再重复定义菜单类型，各消费方统一从本模块 import。

/** 菜单类型：0-目录，1-菜单，2-按钮 */
export type MenuType = 0 | 1 | 2;

/**
 * 后端下发的菜单项（平铺结构）
 * 字段可选性以后端实际返回为准：
 *  - menuId / parentId / menuName / menuType / path 每个菜单项都有（必填）
 *  - 其余字段可为空（如按钮无 icon、目录/按钮的 component 为空、perms 可为 null）
 */
export interface MenuItem {
  menuId: number;
  parentId: number;
  menuName: string;
  /** 菜单类型：0-目录，1-菜单，2-按钮 */
  menuType: MenuType;
  /** 路由地址（如 /roleManage） */
  path: string;
  /** 组件相对路径（如 roleManage/index），目录/按钮可空 */
  component?: string;
  /** 权限标识（按钮节点，如 role:add） */
  perms?: string | null;
  /** 图标名 */
  icon?: string;
  /** 排序号 */
  orderNum?: number;
  /** 是否 iframe 嵌入：0-否，1-是 */
  isIframe?: number;
  /** 是否全屏展示：0-否，1-是（打开时隐藏侧边栏/顶栏/Tab，仅菜单类型有效） */
  isFullScreen?: number;
  /** 状态：0-正常 1-停用 */
  status?: number;
}

/**
 * 菜单树节点：平铺菜单项组装成树后的形态
 * 仅在前端需要树形结构的地方（侧边栏、授权树、父级选择器）使用
 */
export type MenuTree = MenuItem & { children?: MenuTree[] };
