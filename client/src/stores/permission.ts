// 权限状态：动态菜单树、按钮权限点、角色编码
// 仅承载 RBAC 相关的运行时状态（菜单/权限），路由注册逻辑在 router 守卫中完成
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { HOME_PAGE_PATH } from '@/router'
import { getFirstMenuPath } from '@/utils/permission'
import type { MenuItem, MenuTree } from '@/types/router'

export const usePermissionStore = defineStore('permission', () => {
  /** 首页路径 */
  const homePath = ref(HOME_PAGE_PATH)
  /** 后端下发的菜单平铺列表（原始数据） */
  const menuList = ref<MenuItem[]>([])
  /** 组装后的菜单树（侧边栏渲染数据） */
  const menuTree = ref<MenuTree[]>([])
  /** 按钮权限点集合（如 role:add） */
  const perms = ref<string[]>([])
  /** 当前用户角色编码集合 */
  const roles = ref<string[]>([])
  /** 动态路由是否已注册（避免重复 addRoute） */
  const isRoutesLoaded = ref(false)

  /** 设置菜单数据并组装树 */
  function setMenus(list: MenuItem[]) {
    menuList.value = list
    menuTree.value = buildTree(list)
    // 首页取树形菜单的第一个有效路径（需在组装树之后）
    setHomePath(HOME_PAGE_PATH || getFirstMenuPath(menuTree.value))
  }

  /** 设置权限点与角色 */
  function setPermissions(permsList: string[], roleList: string[]) {
    perms.value = permsList
    roles.value = roleList
  }

  /**
   * 获取首页路径
   * @returns 首页路径字符串
   */
  const getHomePath = () => homePath.value

  /** 设置首页路径
   * @param path 首页路径
   */
  function setHomePath(path: string) {
    homePath.value = path
  }

  /** 判断是否拥有某权限点 */
  function hasPerm(perm: string): boolean {
    // 超级管理员拥有全部权限
    if (roles.value.includes('R_SUPER')) return true
    return perms.value.includes(perm)
  }

  /** 重置（登出时调用） */
  function reset() {
    menuList.value = []
    menuTree.value = []
    perms.value = []
    roles.value = []
    isRoutesLoaded.value = false
  }

  return {
    menuList,
    menuTree,
    perms,
    roles,
    isRoutesLoaded,
    getHomePath,
    setHomePath,
    setMenus,
    setPermissions,
    hasPerm,
    reset,
  }
})

/**
 * 平铺菜单列表组装成树
 * 父节点缺失时降级为根节点，避免断头
 */
function buildTree(list: MenuItem[]): MenuTree[] {
  const map = new Map<number, MenuTree>()
  list.forEach((item) => map.set(item.menuId, { ...item, children: [] }))

  const roots: MenuTree[] = []
  list.forEach((item) => {
    const node = map.get(item.menuId)!
    if (item.parentId === 0 || !map.has(item.parentId)) {
      roots.push(node)
    } else {
      map.get(item.parentId)!.children!.push(node)
    }
  })
  return roots
}
