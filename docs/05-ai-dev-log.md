# AI 开发会话日志

> 两台 Claude（台式机 & 笔记本）之间的上下文传递通道。
> 每次 AI 开发会话结束后，在此追加一条记录，然后 commit 到 Git。

---

## 2026-07-06 (笔记本)

**完成内容**：
- 建立多设备 AI 协作体系

**关键决策**：
- 采用三层上下文体系：CLAUDE.md（总览）+ 本日志（接力）+ Commit Message（隐式）
- 所有 AI 决策必须写入 git 追踪文件，禁止依赖本地 Memory

**踩坑记录**：
- 无（会话初始化）

**下一步**：
- 待用户指定下一个开发任务

---

## 2026-07-06 (笔记本) — fun-2 认证逻辑修复

**完成内容**：
- 审计注册/登录逻辑，发现 7 个问题，全部修复
- 统一注册/登录响应格式为 `{ token, user: {...} }`
- 注册支持 display_name（前端已收集但之前丢弃）
- Session 表写入 + JWT jti 声明
- 提取 `src/utils/constants.ts` 共享常量
- 前端按钮防抖（请求期间禁用）
- 清理 auth.ts 中的死代码 emailExists
- 编写 test-smoke.mjs 冒烟测试（34 项全通过）
- TypeScript 类型检查通过

**关键决策**：
- userResponse() 函数统一所有返回用户数据的格式，包含 id/email/provider/display_name/avatar_url/created_at
- Session 写入与 D1 插入在同一代码路径，本地回退使用 localDB.createSession()
- JWT 现包含 jti 声明，为后续服务端黑名单注销做准备

**踩坑记录**：
- 当前 Node v19.9.0，Wrangler 需要 >=22，无法运行 `npm run dev`。冒烟测试用纯 Node.js 绕过
- bcryptjs 当前版本输出 `$2b$` 前缀（非 `$2a$`），都合法
- `c.req.json()` 解析失败会抛异常，必须 try/catch 包裹

**下一步**：
- 合并 fun-2 → master（PR: https://github.com/b3njam1n-cpt/play4fun/pull/new/fun-2）
- wrangler login → 创建 D1 → 部署上线
- 升级 Node.js 到 22+ 以支持 Wrangler 本地开发

---
