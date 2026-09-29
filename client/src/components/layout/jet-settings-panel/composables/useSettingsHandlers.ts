import { useSettingStore } from '@/stores/setting'
// import { storeToRefs } from 'pinia'

export function useSettingsHandlers() {
  const settingStore = useSettingStore()

  // 通用切换处理器
  const createToggleHandler = (storeMethod: () => void, callback?: () => void) => {
    return () => {
      storeMethod()
      callback?.()
    }
  }

  // 通用值变更处理器
  const createValueHandler = <T>(
    storeMethod: (value: T) => void,
    callback?: (value: T) => void,
  ) => {
    return (value: T) => {
      storeMethod(value)
      callback?.(value)
    }
  }

  // 基础设置处理器
  const basicHandlers = {
    // 显示进度条
    nprogress: createToggleHandler(() => settingStore.setNprogress()),
    // 页面切换过渡动画
    pageTransition: createValueHandler((value) => settingStore.setPageTransition(value)),
  }

  return {
    basicHandlers,
  }
}
