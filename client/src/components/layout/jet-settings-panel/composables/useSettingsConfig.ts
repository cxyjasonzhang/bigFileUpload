import { computed } from 'vue'

export function useSettingsConfig() {
  // 页面切换动画选项
  const pageTransitionOptions = computed(() => [
    {
      value: '',
      label: '无动画',
    },
    {
      value: 'fade',
      label: '淡入淡出',
    },
    {
      value: 'slide-left',
      label: '左侧滑入',
    },
    {
      value: 'slide-bottom',
      label: '下方滑入',
    },
    {
      value: 'slide-top',
      label: '上方滑入',
    },
  ])

  // ... 扩展其他选项

  // 基础设置项配置
  const basicSettingsConfig = computed(() => {
    const allSettings = [
      {
        key: 'showNprogress',
        label: '显示顶部进度条',
        type: 'switch' as const,
        handler: 'nprogress',
        headerBarKey: null, // 不依赖headerBar配置
      },
      {
        key: 'pageTransition',
        label: '页面切换动画',
        type: 'select' as const,
        handler: 'pageTransition',
        options: pageTransitionOptions.value,
        style: { width: '120px' },
      },
    ]
    return allSettings
  })

  return {
    pageTransitionOptions,
    basicSettingsConfig,
  }
}
