# ADR-0007：前端代码规范工具链（ESLint + Prettier）

- 日期：2026-09-10
- 状态：已接受
- 关联：`frontend-spec`（前端开发规范 skill）、ADR-0001（Element Plus 按需导入）

## 背景

`client/` 此前没有任何 lint / 格式化配置，代码风格实际处于「两种并存」的状态：

- `src/utils/auth.ts`、`vite.config.ts` 使用**双引号 + 分号**；
- `src/pages/iconManager/components/IconGrid.vue`、`src/pages/menuManage/modules/menu-edit-dialog.vue`、`env.d.ts` 使用**单引号 + 无分号**。

项目自带的 `frontend-spec` skill 规定「2 空格 / 单引号 / 语句末尾分号」，但其中「分号」一条与实际代码主流写法相反。同时 `unplugin-auto-import` 会注入 `ref` / `computed` / `ElMessage` 等全局变量，任何 lint 方案都必须认识它们，否则会产生大量 `no-undef` 误报。

## 决策

### 1. 职责分离：ESLint 管质量，Prettier 管格式

- ESLint 9 flat config（`client/eslint.config.js`）只负责代码质量；格式化全部交给 Prettier。
- 用 `eslint-config-prettier` 关闭所有与 Prettier 冲突的格式类规则，且**置于配置数组最后**。
- 不采用 `eslint-plugin-prettier`（把 Prettier 当 ESLint 规则跑）：会拖慢 lint，且格式报错与质量报错混杂，定位困难。

### 2. 规则档位：务实起步

- 采用 `eslint-plugin-vue` 的 `flat/recommended` + `typescript-eslint` 的 `recommended`（**非类型感知**，不引入 `parserOptions.project`，避免 lint 变慢）。
- `@typescript-eslint/no-explicit-any`、`@typescript-eslint/no-unused-vars`、`no-console` 一律设为 **warn**。理由：现存代码有较多 `any` 与 `console`，若设为 error 会一次性产生大量失败，阻碍落地。
- 关闭 `vue/multi-word-component-names`：页面组件普遍命名为 `index.vue`，该规则在此结构下不适用。

### 3. 自动导入全局变量：消费生成文件

- 在 `eslint.config.js` 中读取 `unplugin-auto-import` 生成的 `client/.auto-import.json`，将其 `globals` 注入 `languageOptions.globals`。
- 该文件已纳入版本管理，fresh clone 亦可解析；不手工维护 globals 白名单，避免新增自动导入 API 时漏配。
- 用 `readFileSync` + `JSON.parse` 而非 `import ... with { type: 'json' }`，以兼容 Node 18 / 20。
- **同时关闭 `no-undef`**：实测该规则在此项目存在两类**必然误报** —— ① `.vue` 中的全局 TS 类型命名空间（如 `Api.SystemManage.RoleListItem`）；② 由 `ElementPlusResolver` 注入的 `ElMessage` / `ElMessageBox` **并不在** `.auto-import.json` 中（unplugin-auto-import 的 eslintrc 只导出 preset 导入项，无法枚举 resolver 结果）。标识符是否存在交由 `vue-tsc` 判定，这也是 typescript-eslint 的官方建议。

### 4. 代码风格（Prettier）

| 选项 | 取值 |
| --- | --- |
| `semi` | `false`（**不加分号**） |
| `singleQuote` | `true` |
| `printWidth` | `100` |
| `trailingComma` | `all` |
| `arrowParens` | `always` |
| `tabWidth` | `2` |
| `vueIndentScriptAndStyle` | `false` |
| `endOfLine` | `lf` |

**关于 `semi: false` 与既有规范的冲突**：`frontend-spec` 原文要求「语句末尾分号」，但实际代码主流（全部 `.vue` 文件、`env.d.ts`）为无分号。本次以**代码现状 + 更少噪音**为准，选择 `semi: false`，并**同步修改 `frontend-spec`**，避免文档与工具长期打架。

### 5. 依赖管理：npm workspaces

- 新增根 `package.json`，声明 `workspaces: ["client", "server"]`。
- 理由：husky 的钩子必须位于 git 根目录，而 eslint / prettier 安装在 `client/`。启用 workspaces 后，根 `npm install` 一次装齐并提升依赖，根上的 `lint-staged` 可直接调用 `eslint` / `prettier`，无需 `npm --prefix` 之类的间接转发。
- 代价：安装入口由 `cd client && npm install` 变为**仓库根 `npm install`**；`client/`、`server/` 的嵌套 lockfile 失效。

### 6. 提交前强制：husky + lint-staged

- `pre-commit` 对**暂存文件**执行 `eslint --fix` + `prettier --write`，修复结果写回并纳入本次提交。
- 若存在 ESLint **无法自动修复的 error**，则阻断提交（warn 不阻断）。
- 因 lint-staged 从仓库根运行而 ESLint 配置位于 `client/`，命令显式携带 `--config client/eslint.config.js`（ESLint 9 flat config 默认只在 cwd 查找配置）。

### 7. 存量代码：一次性全量格式化

- 配置落地后对 `client/` 全量执行 `prettier --write` + `eslint --fix`，作为**独立提交**。
- 配套 `.git-blame-ignore-revs` 指向该提交，减少 `git blame` 噪音。
- 理由：不一次性收敛的话，「两种风格并存」的现状会长期存在。

### 8. 运行环境：锁定并自动定位 Node 版本

- 根目录新增 `.node-version`（`22.22.1`），与根 `package.json` 的 `engines: node >20` 呼应，fnm / nvm 用户 `cd` 进入仓库时自动切换。
- **必要性**：ESLint 9 加载 flat config 时会用到 `structuredClone`（Node 17+ 才有）。若用 Node 16 执行，抛出的是 `ConfigError: ... structuredClone is not defined` —— 该信息与真实问题无关，极易误导排查方向，且直接阻断提交。
- **`.husky/pre-commit` 不信任 PATH 上的 node**：编辑器的 Git 集成不加载 shell profile，`fnm env --use-on-cd` 对它无效，其 PATH 上可能是一个过低的 Node（本机即因系统 PATH 残留了一个指向 `fnm aliases/default` 的会话软链，使编辑器始终拿到 Node 16）。
  故钩子自行在版本管理器目录中查找 Node：先按 `.node-version` 精确匹配（覆盖 fnm 的 `node-versions/*/installation`、nvm 的 `v*`、系统安装目录），匹配不到再退化为「已安装的最高版本」；选中后把该目录置于 PATH 最前，供 `eslint` / `prettier` 子进程使用。找不到任何合格版本时输出可操作提示并阻断。
- 新增 `.gitattributes` 强制 `.husky/**` 与 `*.sh` 使用 LF：Windows 下 `core.autocrlf=true` 会把钩子脚本检出为 CRLF，多行脚本会因此解析失败。

## 后果

- 新增文件：根 `package.json`、`.node-version`、`.gitattributes`、`.husky/pre-commit`、`.editorconfig`、`.vscode/settings.json`、`.vscode/extensions.json`、`.git-blame-ignore-revs`、`client/eslint.config.js`、`client/.prettierrc.json`、`client/.prettierignore`。
- `client/package.json` 新增 7 个 devDependencies（`eslint`、`@eslint/js`、`eslint-plugin-vue`、`typescript-eslint`、`eslint-config-prettier`、`globals`、`prettier`）与 4 个 scripts（`lint` / `lint:fix` / `format` / `format:check`）。
- `.gitignore` 移除 `docs/`：`docs/`（ADR、standards、agents、plans）自此纳入版本管理；此前 ADR-0001 ~ 0006 均未被 git 跟踪。
- 安装方式变更：需在**仓库根**执行 `npm install`；`client/`、`server/` 的 `package-lock.json` 变为冗余，建议删除。
- 运行 lint 需要 Node ≥ 18.18（本项目声明 `engines: node >20`）。
- 已知未做：未开启类型感知规则（`recommendedTypeChecked`）、未接入 CI、未启用 `--max-warnings=0`。以上均为后续可按需收紧的项。
