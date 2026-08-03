# 共享包设计原则和 TypeScript 集成已掌握

用户理解了 Monorepo 中共享包的设计原则（什么该抽、什么不该抽、两个应用用就抽的判断标准），
掌握了三层 TSConfig 架构（base → extends），以及共享包的 package.json 入口配置（main/types/exports）。
通过升级 shared-utils 为 TypeScript 的完整实战，体验了跨包引用时的类型提示和 IDE 跳转。

## Implications
- 用户已掌握 Monorepo 的核心开发体验（包间引用 + 类型安全）
- 共享配置包（ESLint/Prettier）点到为止，仅在进阶阶段再展开
- 下一课引入 Turborepo，解决"改了 shared-utils 后 admin 没有自动重构建"的问题
- 用户对依赖分层管理（什么依赖放哪里）已有清晰认知
