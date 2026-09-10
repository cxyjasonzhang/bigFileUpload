import { readFileSync } from 'node:fs'

import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * 读取 unplugin-auto-import 生成的全局变量清单。
 * 由 vite.config.ts 的 AutoImport({ eslintrc: { filepath: './.auto-import.json' } }) 产出，
 * 该文件已纳入版本管理，因此 fresh clone 也能正常解析。
 */
function loadAutoImportGlobals() {
  const file = new URL('./.auto-import.json', import.meta.url)
  try {
    return JSON.parse(readFileSync(file, 'utf-8')).globals ?? {}
  } catch {
    throw new Error(
      '未找到 client/.auto-import.json（自动导入全局变量清单）。请先执行 `npm run dev` 或 `npm run build` 生成后再运行 lint。',
    )
  }
}

export default tseslint.config(
  {
    // 忽略产物与自动生成的文件（使用 ** 前缀，避免受 cwd / config 位置影响）
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/src/components.d.ts',
      '**/src/types/import/auto-imports.d.ts',
      '**/.auto-import.json',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    // .vue 的 <script lang="ts"> 交给 typescript-eslint 解析
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  {
    languageOptions: {
      // 自动导入的全局 API（ref / computed / ElMessage…）在此显式声明，与 vite 侧保持一致
      globals: {
        ...globals.browser,
        ...loadAutoImportGlobals(),
      },
    },
    rules: {
      // 页面组件普遍以 index.vue 命名，不适用「多单词组件名」约束
      'vue/multi-word-component-names': 'off',

      // 标识符是否存在交给 TypeScript 判定（vue-tsc 已覆盖），故按 typescript-eslint 官方建议关闭：
      // ① .vue 中的全局类型命名空间（如 `Api.SystemManage.RoleListItem`）会被 no-undef 误报；
      // ② 由 resolver 注入的 ElMessage / ElMessageBox 不在 .auto-import.json 中
      //    （unplugin-auto-import 的 eslintrc 只导出 preset 导入项，无法枚举 resolver 结果）。
      'no-undef': 'off',

      // 起步阶段统一降级为 warn，先保证零 error 跑通，后续再逐步收紧
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },

  // 必须放在最后：关闭所有与 Prettier 冲突的格式类规则
  eslintConfigPrettier,
)
