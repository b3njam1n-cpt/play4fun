# Changelog

每个合并进 master 的分支所做变更的简明记录。

---

## fun-3 — 登录后主页 + 本地开发环境

**合并日期**: 2026-07-06
**PR**: [#3](https://github.com/b3njam1n-cpt/play4fun/pull/3)

### 新增
- 登录后主页视图：复用 Unsplash 背景，左上角渐变色欢迎语「欢迎 {用户名} 来我们的 playground」
- 中英文双语主页文案
- 本地开发环境：`npx tsx server.js` 启动 (:3000)，启动时自动种子测试用户
- 本地测试用户：`test@example.com` / `test1234` / `Tester`

### 修复
- Node.js 环境下 `c.env` 为 undefined 导致 API 崩溃 → `src/index.ts` 添加默认 Bindings 中间件

### 依赖
- 新增 `@hono/node-server` + `tsx` (devDependencies)

---

## fun-2 — 修复认证逻辑 7 个问题

**合并日期**: 2026-07-06
**PR**: [#2](https://github.com/b3njam1n-cpt/play4fun/pull/2)

### 变更
- **统一注册/登录响应格式** — 都返回 `{ token, user: { id, email, provider, display_name, avatar_url, created_at } }`
- **注册支持 display_name** — 前端用户名输入框不再被丢弃，Zod schema 新增可选字段，存入数据库
- **Session 表写入 + JWT jti** — 登录/注册时写入 sessions 表，JWT 含 jti 声明，为服务端注销打基础
- **提取共享常量** — 新增 `src/utils/constants.ts`（JWT_SECRET fallback、Cookie 配置等），消除重复硬编码
- **前端按钮防抖** — 登录/注册按钮在请求期间禁用，防止重复提交
- **清理死代码** — 移除 `auth.ts` 中未使用的 `emailExists` 函数

### 新增文件
- `src/utils/constants.ts` — JWT / Cookie / bcrypt 共享常量
- `test-smoke.mjs` — 本地冒烟测试（34 项）

---

## fun-1 — 初始 MVP（响应式布局 + 认证基础）

**合并日期**: 2026-07 (首次合并)
**PR**: [#1](https://github.com/b3njam1n-cpt/play4fun/pull/1)

### 新增
- 响应式布局：Figma 设计还原，Unsplash 全屏背景，Dynamic Island 搜索栏
- 中英文语言切换
- 邮箱+密码注册/登录（bcrypt + JWT httpOnly Cookie）
- Cloudflare Workers + D1 架构
- 登录状态持久化（`GET /auth/me` 恢复会话）
- 侧滑登录/注册面板（毛玻璃效果）
- `docs/` 目录：架构、API、数据库、路线图文档
