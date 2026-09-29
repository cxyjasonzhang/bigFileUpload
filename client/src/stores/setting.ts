/**
 * 系统设置状态管理模块
 *
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { SETTING_DEFAULT_CONFIG } from '@/config/setting'

export const useSettingStore = defineStore(
  'settingStore',
  () => {
    /** 是否显示进度条 */
    const showNprogress = ref(SETTING_DEFAULT_CONFIG.showNprogress)
    /** 页面过渡效果 */
    const pageTransition = ref(SETTING_DEFAULT_CONFIG.pageTransition)

    /**
     * 切换进度条展示
     */
    const setNprogress = () => {
      showNprogress.value = !showNprogress.value
    }

    /**
     * 设置页面过渡效果
     * @param transition 过渡效果名臣
     */
    const setPageTransition = (transition: string) => {
      pageTransition.value = transition
    }

    return {
      showNprogress,
      pageTransition,
      setNprogress,
      setPageTransition,
    }
  },
  {
    persist: {
      key: 'setting',
      storage: localStorage,
    },
  },
)
