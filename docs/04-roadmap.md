# play4fun 功能路线图

## 图例

- [x] 已完成
- [ ] 待实现
- 🚧 进行中

---

## Phase 1: MVP — 传统登录 + 个人主页

> 目标：跑通全流程，部署到 Cloudflare，线上可访问

- [x] 项目骨架搭建（Wrangler + Hono + TS）
- [x] D1 数据库建表 + 创建（本地 & 远程）
- [x] `POST /auth/register` — 邮箱注册
- [x] `POST /auth/login` — 密码登录
- [x] `POST /auth/logout` — 登出
- [x] `GET /auth/me` — 获取当前用户
- [x] JWT 中间件
- [x] 前端登录/注册页面
- [x] 前端个人主页（登录后可见）
- [x] Cloudflare 部署（workers.dev 已上线）
- [ ] 域名绑定（workers.dev 墙内不可用，需自定义域名）
- [ ] GitHub Actions CI/CD

---

## Phase 2: Google SSO + SLO

> 目标：接入 Google 登录，实现单点登出

- [ ] Google OAuth2 配置（Cloud Console）
- [ ] `GET /auth/google` — 发起 OAuth
- [ ] `GET /auth/google/callback` — 回调处理
- [ ] 账户关联逻辑（同 email 自动合并）
- [ ] `POST /auth/slo` — 单点登出
- [ ] 多设备 Session 管理
- [ ] Session 黑名单（登出即失效）

---

## Phase 3: 个人主页完善

> 目标：丰富内容，使用 AI 工具生成布局

- [ ] 响应式布局（移动端适配）
- [ ] 个人简介 / 技能 / 项目展示
- [ ] 深色模式
- [ ] 页面导航
- [ ] 使用 v0.dev 生成布局 → 迁移到项目

---

## Phase 4: 运维 + 扩展

> 目标：生产级部署，双平台兼容，远程访问家庭电脑

- [ ] Cloudflare Tunnel 内网穿透（连接家庭电脑到 CF 边缘网络）
- [ ] Docker 容器化
- [ ] docker-compose 本地编排
- [ ] Oracle Cloud 部署适配

### 4.1 远程家庭电脑访问

> 架构：浏览器 → vieplay4fun.win → Cloudflare Tunnel → 家中电脑
> 每个用户可通过命令行启动一个网页终端，访问自己家庭电脑

- [ ] 家中电脑安装 `cloudflared`（轻量代理，CPU 占用 < 1%）
- [ ] ttyd / wetty：把 SSH 终端变成网页（WebSocket）
- [ ] Cloudflare Tunnel 代理到 Worker → 用户浏览器
- [ ] 两种模式可选：
  - **终端模式**：类似 Linux 命令行，文件操作、运行脚本（推荐先做）
  - **桌面模式**：VNC/NoVNC 远程桌面（延迟高、带宽大，远期再做）
- [ ] 权限隔离：仅登录用户可访问自己的电脑
- [ ] D1 记录连接状态（在线/离线、上次连接时间）

> **技术难度**：终端模式约 4h | 桌面模式额外 8h
> **关键依赖**：家中电脑需要开机 + 联网（可配合 Wake-on-LAN）

- [ ] PostgreSQL 迁移（D1 → PG）
- [ ] 监控 + 日志

---

## Phase 5: 社交功能 — 签到 + 留言墙

> 目标：不依赖 AI，纯 CRUD + D1，建立每日打开习惯

- [ ] 每日签到打卡（记录连续天数，D1）
- [ ] 朋友留言墙（短消息、便签风格）
- [ ] 匿名树洞（登录后发表/查看）
- [ ] 共享倒计时（集体事件，如"下次聚会还剩 X 天"）
- [ ] 你画我猜（Canvas 绘画 + 猜想）

---

## Phase 6: Play4Fun 代码沙箱

> 目标：朋友上传 JS 代码，生成图标，在浏览器沙箱中运行

### 6.1 代码上传与展示
- [ ] 代码上传页面（拖拽/粘贴 .js/.html）
- [ ] D1 存储元数据（文件名、作者、上传时间）
- [ ] 文件内容存储（D1 TEXT 字段 or R2）
- [ ] Canvas 首字母图标生成（文件名首字 + 随机渐变）

### 6.2 浏览器沙箱执行
- [ ] 游戏检测（扫描是否含 Canvas/DOM API）
- [ ] 全屏 iframe sandbox 运行游戏
- [ ] 新建浏览器标签打开
- [ ] 非游戏 → xterm.js 模拟终端（JS eval 沙箱）

### 6.3 Linux 控制台（远期）
- [ ] 评估 Oracle Cloud Always Free（4C 24G ARM，免费）
- [ ] Docker 容器化用户环境
- [ ] CF Worker 转发 WebSocket
- [ ] 真正的 Linux 体验（不是模拟）

> **技术难度**：Phase 6.1 + 6.2 约 9h | Phase 6.3 额外 8h
> **关键约束**：CF Workers 无 shell → 真正 Linux 需外部 VM

---

## Phase 7: 未来功能池

> 需求池，按优先级排期

- [ ] GitHub OAuth 登录
- [ ] 博客模块
- [ ] 文件存储（R2 / OCI Object Storage）
- [ ] API 速率限制
- [ ] 管理后台（Admin Dashboard）
- [ ] WebSocket 实时通知

---

## 每次新增功能时的规则

1. **接口变更 → 更新 `docs/02-api-auth.md`**
2. **表结构变更 → 更新 `docs/03-database-schema.md`**
3. **架构调整 → 更新 `docs/01-architecture.md`**
4. **新功能落地 → 更新本文档**
5. **所有 API 接口必须在 `docs/` 中有对应文档**

> 违反以上规则 = 功能不完整。文档即契约。
