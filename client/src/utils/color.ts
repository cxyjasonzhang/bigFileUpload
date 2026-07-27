/**
 * 颜色工具：运行时生成 Element Plus 主题色变体
 * Element Plus 使用 --el-color-primary-light-3/5/7/8/9
 * 通过 hex 颜色与白色混合来近似这些变体
 */

/** 将 hex 颜色解析为 r/g/b 数组 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** 混合两个颜色，ratio 为目标色占比（0-1） */
function mixColor(hex1: string, hex2: string, ratio: number): string {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const r = Math.round(r1 * ratio + r2 * (1 - ratio));
  const g = Math.round(g1 * ratio + g2 * (1 - ratio));
  const b = Math.round(b1 * ratio + b2 * (1 - ratio));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * 给 :root 设置主题色相关的 CSS 变量
 * @param color 主题色 hex 值，如 "#5D87FF"
 */
export function setPrimaryColor(color: string): void {
  const root = document.documentElement;

  // 主色
  root.style.setProperty("--el-color-primary", color);
  root.style.setProperty("--el-color-primary-dark-2", mixColor(color, "#000000", 0.8));

  // light 变体（与白色混合，越大的数字越淡）
  root.style.setProperty("--el-color-primary-light-3", mixColor(color, "#ffffff", 0.7));
  root.style.setProperty("--el-color-primary-light-5", mixColor(color, "#ffffff", 0.5));
  root.style.setProperty("--el-color-primary-light-7", mixColor(color, "#ffffff", 0.3));
  root.style.setProperty("--el-color-primary-light-8", mixColor(color, "#ffffff", 0.2));
  root.style.setProperty("--el-color-primary-light-9", mixColor(color, "#ffffff", 0.1));
}

/** Element Plus 默认主题色 */
export const DEFAULT_PRIMARY_COLOR = "#409eff";

/** 可选主题色列表 */
export const THEME_COLORS = [
  "#5D87FF",
  "#B48DF3",
  "#1D84FF",
  "#60C041",
  "#38C0FC",
  "#F9901F",
  "#FF80C8",
] as const;
