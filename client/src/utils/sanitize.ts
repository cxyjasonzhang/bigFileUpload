// sanitize.ts - 不可信标记片段的统一清洗入口
//
// 背景：v-html 会把字符串当 HTML 解析并执行。若内容来自服务端接口、
// 用户上传的 SVG 文件或 IndexedDB 缓存，就可能被注入 <script>、
// on* 事件属性、javascript: 协议等 XSS 载体。
// 因此所有交给 v-html 的 SVG 内容都应先经过这里清洗。

import DOMPurify from 'dompurify'

/**
 * 清洗 SVG 标记片段，用于 v-html 安全渲染
 *
 * 采用 SVG 专用白名单（比默认的 HTML + SVG + MathML 白名单更严格）：
 * - 保留：svg 及其图形 / 结构标签、`<style>`、滤镜元素（feGaussianBlur 等）
 * - 移除：`<script>`、`<foreignObject>`、`<use>`、所有 on* 事件属性、javascript: 协议
 *
 * @param dirty 不可信的原始 SVG 字符串
 * @returns 清洗后的安全字符串；入参为空时返回空串
 */
export function sanitizeSvg(dirty: string): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, { USE_PROFILES: { svg: true, svgFilters: true } })
}
