import { type App } from 'vue'
import { setupRippleDirective, type RippleDirective } from './business/ripple'
import { setupHighlightDirective, type HighlightDirective } from './business/highlight'

export function setupGlobDirectives(app: App) {
  setupRippleDirective(app) // 水波纹指令
  setupHighlightDirective(app) // 高亮指令
}

export type { RippleDirective, HighlightDirective }