/**
 * 主题 composable：将 layout store 中的主题状态应用到 DOM
 * - 切换 <html class="dark"> 控制 Element Plus 暗色模式
 * - 注入 --el-color-primary-* CSS 变量
 */
import { watch, onMounted } from "vue";
import { useLayoutStore } from "@/stores/layout";
import { setPrimaryColor, DEFAULT_PRIMARY_COLOR } from "@/utils/color";
import { storeToRefs } from "pinia";

/** 在 App.vue（或 AppLayout.vue）的 setup 中调用一次，建立响应式主题绑定 */
export function useTheme(): void {
  const store = useLayoutStore();
  const { mode, primaryColor } = storeToRefs(store);

  /** 根据当前状态应用主题 */
  function apply() {
    const html = document.documentElement;

    // 暗色模式
    if (mode.value === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }

    // 主题色
    setPrimaryColor(primaryColor.value || DEFAULT_PRIMARY_COLOR);
  }

  // 初始化时应用一次
  onMounted(apply);

  // mode 和 primaryColor 变化时重新应用
  watch([mode, primaryColor], apply);
}
