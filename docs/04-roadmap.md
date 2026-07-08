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

> 目标：生产级部署，双平台兼容

- [ ] Cloudflare Tunnel 内网穿透
- [ ] Docker 容器化
- [ ] docker-compose 本地编排
- [ ] Oracle Cloud 部署适配
- [ ] PostgreSQL 迁移（D1 → PG）
- [ ] 监控 + 日志

---

## Phase 5: 未来功能池

> 需求池，按优先级排期

- [ ] GitHub OAuth 登录
- [ ] 博客模块
- [ ] 文件存储（R2 / OCI Object Storage）
- [ ] API 速率限制
- [x] 管理后台（Admin Dashboard）
- [ ] WebSocket 实时通知

---

## 每次新增功能时的规则

1. **接口变更 → 更新 `docs/02-api-auth.md`**
2. **表结构变更 → 更新 `docs/03-database-schema.md`**
3. **架构调整 → 更新 `docs/01-architecture.md`**
4. **新功能落地 → 更新本文档**
5. **所有 API 接口必须在 `docs/` 中有对应文档**

> 违反以上规则 = 功能不完整。文档即契约。
