// 权限控制工具：按钮级权限点判断 + v-perms 指令

import type { App, Directive } from 'vue'
import { usePermissionStore } from '@/stores/permission'
import type { MenuTree } from '@/types/router'

/**
 * 判断当前用户是否拥有某个权限点
 * @param perm 权限标识（如 "role:add"）
 */
export function hasPerms(perm?: string): boolean {
  if (!perm) return true
  const store = usePermissionStore()
  return store.hasPerm(perm)
}

/**
 * v-perms 指令：无权限时移除元素
 * 用法：<el-button v-perms="'role:add'">新增</el-button>
 * 支持数组（满足任一即显示）：v-perms="['role:add', 'role:edit']"
 */
const permsDirective: Directive<HTMLElement, string | string[]> = {
  mounted(el, binding) {
    const perms = binding.value
    const list = Array.isArray(perms) ? perms : [perms]
    const store = usePermissionStore()
    const allowed = list.some((p) => store.hasPerm(p))
    if (!allowed) {
      el.parentNode?.removeChild(el)
    }
  },
}

/** 注册权限指令（在 main.ts 中调用一次） */
export function setupPermission(app: App) {
  app.directive('perms', permsDirective)
}

/**
 * 标准化路径格式
 * @param path 路径
 * @returns 标准化后的路径
 */
const normalizePath = (path: string): string => {
  return path.startsWith('/') ? path : `/${path}`
}

/**
 * 递归获取菜单的第一个有效路径
 * @param menuList 菜单列表
 * @returns 第一个有效路径，如果没有找到则返回空字符串
 */
export const getFirstMenuPath = (menuList: MenuTree[]): string => {
  if (!Array.isArray(menuList) || menuList.length === 0) {
    return ''
  }

  for (const menuItem of menuList) {
    // if (!isNavigableMenuItem(menuItem)) {
    //   continue
    // }

    // 如果有子菜单，优先查找子菜单
    if (menuItem.children?.length) {
      const childPath = getFirstMenuPath(menuItem.children)
      if (childPath) {
        return childPath
      }
    }

    // 返回当前菜单项的标准化路径
    return normalizePath(menuItem.path!)
  }

  return ''
}
