<template>
  <span
    class="svg-icon"
    :style="iconStyle"
    v-html="svgContent"
    v-show="svgContent"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { get as getCachedIcon } from '@/utils/iconCache'

/**
 * SvgIcon - SVG 图标渲染组件
 * 使用方式：<SvgIcon name="object/history" size="20" color="#1890ff" />
 */
const props = defineProps({
  /** 图标引用名，格式：分组slug/图标名 */
  name: { type: String, required: true },
  /** 图标尺寸，数字默认px，也可传字符串如 '1.5em' */
  size: { type: [Number, String], default: 24 },
  /** 图标填充色 */
  color: { type: String, default: 'currentColor' },
})

const svgContent = ref('')

// 监听 name 变化重新加载（三级缓存：内存 → IndexedDB → 网络）
watch(() => props.name, fetchIcon, { immediate: true })

/**
 * 通过三级缓存加载 SVG 内容；失败时静默隐藏
 * 严格按版本：缓存失效后必走网络，网络失败则隐藏
 */
async function fetchIcon() {
  if (!props.name) {
    svgContent.value = ''
    return
  }
  try {
    svgContent.value = await getCachedIcon(props.name)
  } catch {
    // 加载失败（401 / 断网 / 图标不存在）→ 静默隐藏
    svgContent.value = ''
  }
}

/**
 * 动态样式：尺寸 + 颜色
 */
const iconStyle = computed(() => ({
  display: 'inline-flex',
  width: typeof props.size === 'number' ? `${props.size}px` : props.size,
  height: typeof props.size === 'number' ? `${props.size}px` : props.size,
  color: props.color,
}))
</script>

<style scoped lang="scss">
.svg-icon {
  box-sizing: content-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  line-height: 0;

  // 同时覆盖 SVG 根元素和内部含 fill 属性的子元素
  :deep(svg),
  :deep(svg [fill]) {
    fill: currentColor;
  }

  :deep(svg) {
    width: 100%;
    height: 100%;
  }
}
</style>
