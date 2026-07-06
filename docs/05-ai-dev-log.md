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

## 2026-07-06 (笔记本) — fun-3 登录后主页 + 本地环境

**完成内容**：
- 创建登录后主页视图：复用 Unsplash 背景，左上角渐变色欢迎语「欢迎 {用户名} 来我们的 playground」
- 搭设本地开发环境：`npx tsx server.js` 启动（:3000），不依赖 Wrangler
- 启动时自动种子测试用户 `test@example.com / test1234`
- 中英文双语支持主页文案
- 修复 Node.js 环境下 `c.env` 为 undefined 的问题（`src/index.ts` 添加默认 Bindings 中间件）
- 安装 `@hono/node-server` + `tsx` 作为 devDependencies

**关键决策**：
- 本地开发用 `npx tsx server.js` 而非 `npm run dev`（Wrangler 需要 Node ≥22，当前 19.9）
- `server.js` 直接 import TypeScript 源文件（tsx 解析），避免编译步骤
- `c.env` 通过中间件注入默认值，不影响 Cloudflare Workers 生产环境
- 测试用户种子直接写在 `server.js` 中，每次重启自动重建（内存存储，重启即失）

**踩坑记录**：
- `c.env` 在 Node.js 中为 undefined，`c.env.DB` 直接抛 TypeError。必须用中间件在请求时注入默认 env
- `@hono/node-server` v2.0.8 要求 Node ≥20，当前 19.9 虽报警告但实际可用
- Hono 的 `c.json()` 需要 StatusCode 参数，不能直接传数字（用 `{ status } as any` 绕过类型检查）

**下一步**：
- 完善主页内容（目前只有欢迎语，其余待用户定义）
- 考虑主页是否需要导航栏 / 侧边栏 / 功能模块
- 合并 fun-2 → master → fun-3 → master

---

## 2026-07-06 (笔记本) — fun-4 AI 对话功能

**完成内容**：
- 搭建 `/api/chat` SSE 流式端点，同时支持 Gemini 2.0 Flash 和 Llama 3.1 8B
- 搜索栏加入模型选择器 pill（点击切换 Gemini 🧠 / Llama 🦙）
- AI 终端弹窗：macOS 三色按钮、monospace 字体、流式打字+光标闪烁、多轮对话
- 前端 SSE 流读取（fetch + ReadableStream），无第三方依赖

**关键决策**：
- Gemini 免费 tier（15 RPM / 1500 RPD），无需付费即可以本地开发
- Llama 优先用 Workers AI binding，本地回退 REST API
- 未配置 API key 时返回友好错误提示（SSE error 事件），不崩溃
- `c.env` 在本地开发中间件中注入 `process.env`，`chat.ts` 只读 `c.env`

**踩坑记录**：
- Edit 工具对 CJK 文件的 CRLF 行尾匹配失败 → 改 PowerShell 直接操作
- `process.env` 在 CF Workers TS 类型中不存在 → 中间件中 `@ts-ignore` + 运行时 typeof 检查
- Workers AI REST API 返回的 SSE 格式与 Gemini 不同 → 各自独立解析逻辑

**下一步**：
- 去 https://aistudio.google.com/ 获取 Gemini API key，填入 .env
- 浏览器测试完整 AI 对话流程
- 合并 fun-2 → fun-3 → fun-4 → master

---
