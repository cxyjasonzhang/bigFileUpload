# ADR-0001: Element Plus 按需导入

## 状态

已采纳（2026-08-03）

## 背景

项目当前使用 `app.use(ElementPlus)` 全量注册 Element Plus 组件，并导入 `element-plus/dist/index.css` 全量样式（约 240KB）。项目中实际使用了 24 种 `el-*` 组件标签和 2 个命令式 API（`ElMessage`、`ElMessageBox`），全量导入浪费了大量未使用的组件代码和样式。

## 决策

采用 **`unplugin-vue-components` + `unplugin-auto-import`** 实现 Element Plus 按需导入：

1. **组件按需导入**：`unplugin-vue-components` 自动分析 `.vue` 模板中的 `<el-*>` 标签，自动生成对应组件的导入代码。`ElementPlusResolver` 配合 `importStyle: 'css'` 自动导入每个组件的样式文件。
2. **命令式 API 按需导入**：`unplugin-auto-import` 自动处理 `ElMessage`、`ElMessageBox` 等命令式 API，无需手动 `import { ElMessage } from 'element-plus'`。
3. **图标保持全量注册**：`@element-plus/icons-vue` 保持 `app.component` 全量注册。理由：项目大量使用 `<component :is="iconName">` 动态渲染图标（`menuConfig.ts` 中存字符串引用），改为按需会破坏这套机制。图标库体积小，收益有限。
4. **暗色模式 CSS 保留原样**：`element-plus/theme-chalk/dark/css-vars.css` 不受按需导入影响，继续直接 import。

### 具体改动

| 文件 | 改动 |
|---|---|
| `vite.config.ts` | 新增 `unplugin-vue-components` + `unplugin-auto-import` 插件配置 |
| `package.json` | 新增 `unplugin-vue-components`、`unplugin-auto-import` devDependencies |
| `src/main.ts` | 移除 `app.use(ElementPlus)`、移除 `import "element-plus/dist/index.css"`；保留 `app.use(ElementPlusIcons)` 的图标全量注册 |
| `.vue/.ts 文件` | 移除手动 `import { ElMessage, ElMessageBox } from 'element-plus'`（由 auto-import 自动处理） |

## 后果

- **正面**：打包体积显著减小（全量 CSS ~240KB → 按需 ~50KB），构建更快
- **正面**：新增 `el-*` 标签零配置，无需手动维护导入列表
- **负面**：新增 2 个 devDependencies
- **风险**：`unplugin-auto-import` 生成的类型声明文件（`auto-imports.d.ts`）需加入 `.gitignore`
