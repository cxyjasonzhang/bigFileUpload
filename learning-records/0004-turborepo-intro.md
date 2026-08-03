# Turborepo 入门概念已建立

用户理解了 Turborepo 解决的核心问题（构建顺序 + 缓存），掌握了 turbo.json 的 dependsOn 语法
（^build 表示先执行依赖包的构建），理解了基于内容哈希的缓存命中机制。
通过 5 步实战流程掌握了从 pnpm Workspace 迁移到 pnpm + Turborepo 的方法，
并通过对比表理解了 Turborepo / Nx / Lerna 的各自定位。

## Implications
- 用户的 Monorepo 工具链核心三件套已齐：pnpm（包管理）+ TypeScript（类型安全）+ Turborepo（构建加速）
- 下一课进入版本管理：Changesets — 如何管理共享包的版本变更日志
- Turborepo 远程缓存在入门阶段点到为止即可，用户后续团队协作时自然会遇到
