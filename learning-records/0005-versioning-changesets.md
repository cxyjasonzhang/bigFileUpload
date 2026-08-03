# Changesets 版本管理工作流已掌握

用户理解了 Semver 三档版本号（major/minor/patch）的适用场景，掌握了 Changesets 的完整工作流：
写代码 → changeset（标记改动）→ version（统一算版本号+更新依赖）→ publish（发布）。
理解了 changeset 文件的机制（.changeset/ 目录下的 markdown 文件），以及 CI 集成的常用方案。
通过 3 道练习验证了对版本选择决策和操作步骤的理解。

## Implications
- 用户的 Monorepo 知识体系已完整：pnpm（包管理）+ TS（类型） + Turborepo（构建） + Changesets（版本）= 标准四件套
- 入门阶段五课全部完成。后续可进入进阶实战（融入真实项目）或专项深入（如 CI/CD 集成）
