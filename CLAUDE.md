# play4fun — Project Context

## 项目概述

个人主页应用，部署在 Cloudflare Workers。当前 Phase 1 MVP：传统邮箱+密码登录。
目标：全球边缘部署 + SSO/SLO + Oracle Cloud 双平台兼容。

## 技术栈

- **运行时**: Cloudflare Workers (V8)
- **框架**: Hono 4.x (TypeScript)
- **数据库**: D1 (SQLite)，本地开发用内存 Map 回退
- **前端**: Vanilla JS + Tailwind CSS CDN
- **认证**: bcrypt + JWT (jose)
- **容器**: Docker + docker-compose (Phase 4 启用)

## 关键文件

| 文件 | 作用 |
|------|------|
| `src/index.ts` | Worker 入口 |
| `src/routes/auth.ts` | 认证 API |
| `src/middleware/auth.ts` | JWT 中间件 |
| `src/utils/constants.ts` | JWT / Cookie / bcrypt 共享常量 |
| `src/utils/response.ts` | 统一 API 响应格式 |
| `src/db/schema.sql` | D1 建表 |
| `src/db/local-store.ts` | 本地内存数据库（含 User + Session） |
| `public/index.html` | 前端主页面 |
| `public/app.js` | 前端逻辑（当前 v4） |
| `server.js` | Node.js 本地开发入口（`npx tsx server.js`，端口 3000） |
| `test-smoke.mjs` | 本地冒烟测试（Node.js，不依赖 Wrangler） |
| `docs/` | **所有设计文档、API 文档、路线图** |

## 当前进程

- ✅ Phase 1 MVP 核心完成（注册/登录/登出/获取用户 + JWT 中间件 + Session 管理）
- ✅ fun-2 分支：修复 7 个注册/登录问题（响应格式统一、display_name、Session、常量提取、按钮防抖）
- ✅ fun-3 分支：登录后主页 + 本地开发环境（`npx tsx server.js` :3000，自动种子用户）
- ⬜ 下一步：合并 fun-2 → master → fun-3 → master，然后 wrangler login → 创建 D1 → 部署上线
- 📋 完整路线图见 `docs/04-roadmap.md`

## 开发命令

```bash
npx tsx server.js # 启动本地开发服务器 :3000（推荐，自动创建测试用户）
npm run dev       # Wrangler 开发服务器 :8787（需要 Node >= 22）
npm run build     # TypeScript 类型检查
npm run deploy    # 部署到 Cloudflare
```

## 测试用户

| 邮箱 | 密码 | 昵称 |
|------|------|------|
| `test@example.com` | `test1234` | Tester |

> 启动 `npx tsx server.js` 后自动创建。

## 最近决策

> ⚠️ 每次会话结束时更新此部分，这是两台 Claude 之间传递上下文的核心。

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-07-06 | 建立多设备 AI 协作体系 | 台式机+笔记本双设备开发，需要上下文传递机制 |
| 2026-07-06 | fun-2: 统一注册/登录响应为 `{ token, user }` | 之前注册返回 `{ id, email }` 登录返回 `{ token, user: {...} }`，不一致 |
| 2026-07-06 | fun-2: JWT 增加 jti 声明 + Session 表写入 | 为服务端登出和多设备会话管理打基础 |
| 2026-07-06 | fun-3: 登录后主页 + 本地开发环境 | `npx tsx server.js` 在 :3000 运行，种子测试用户，解决 Node 下 c.env 缺失 |
| 2026-07-06 | 分支命名规范：每次大变动新分支 fun-N（N 递增） | 便于回溯和 PR 隔离 |

## 重要规则

1. **所有 API 变更必须同步更新 `docs/02-api-auth.md`**
2. **所有数据库变更必须同步更新 `docs/03-database-schema.md`**
3. **完成一个里程碑后更新 `docs/04-roadmap.md` 勾选 checkbox**
4. **架构变更必须同步更新 `docs/01-architecture.md`**
5. **每个会话结束前，更新本文件中的「当前进程」部分**
6. **每个会话结束前，追加一条记录到 `docs/05-ai-dev-log.md`**

## 多设备 AI 协作规则

> 本项目由 Claude Code 驱动开发，开发者在家用台式机和笔记本之间切换。

1. **开始工作前**：先读 `CLAUDE.md`（当前进程 + 最近决策），再读 `docs/05-ai-dev-log.md` 最后几条记录
2. **结束工作前**：更新 CLAUDE.md 的「当前进程」和「最近决策」，追加 `docs/05-ai-dev-log.md` 会话日志
3. **Commit 信息**：写清楚做了什么 + 为什么，commit body 中注明关键设计决策（另一个 Claude 会读到）
4. **跨设备一致性**：所有 AI 上下文（决策、原因、注意事项）必须写入 git 追踪的文件中
5. **`docs/` 目录是共同大脑**：代码可以自己读，但决策意图只能靠文档传递
