/**
 * 用户状态管理
 * 管理用户登录状态、个人信息、语言设置、搜索历史、锁屏状态等
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('userStore', () => {
  // 登录状态
  const isLogin = ref(false)
  // 用户信息
  const info = ref<Partial<Api.Auth.UserInfo>>({})
  // 访问令牌
  const accessToken = ref('')

  // 计算属性：获取用户信息
  const getUserInfo = computed(() => info.value)

  /**
   * 设置用户信息
   * @param newInfo 新的用户信息
   */
  const setUserInfo = (newInfo: Api.Auth.UserInfo) => {
    info.value = newInfo
  }
})
