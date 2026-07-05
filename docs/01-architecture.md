# play4fun 架构设计

## 概述

play4fun 是一个部署在 Cloudflare Workers 上的个人主页应用。
当前阶段：传统邮箱+密码登录。未来扩展：Google OAuth SSO/SLO。

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 运行时 | Cloudflare Workers (V8) | 全球边缘计算 |
| 框架 | Hono 4.x | 轻量级 Web 框架，兼容 Workers |
| 数据库 | Cloudflare D1 | 边缘 SQLite |
| 缓存 | Cloudflare KV | 键值存储（Session） |
| 前端 | Vanilla JS → React | 起步用原生 JS，后续迁移到 React |
| 样式 | Tailwind CSS (CDN) | 原子化 CSS |
| 认证 | bcrypt + JWT (jose) | 当前：传统登录；预留 Google OAuth |
| 容器 | Docker + docker-compose | Oracle Cloud 兼容 |

## 目录结构

```
play4fun/
├── docs/                    # 📋 设计文档（本目录）
│   ├── 01-architecture.md   # 架构设计
│   ├── 02-api-auth.md       # 认证 API 接口
│   ├── 03-database-schema.md # 数据库设计
│   └── 04-roadmap.md        # 功能路线图
├── src/                     # 后端源码
│   ├── index.ts             # Worker 入口
│   ├── routes/
│   │   └── auth.ts          # 认证路由
│   ├── middleware/
│   │   └── auth.ts          # JWT 验证中间件
│   ├── db/
│   │   └── schema.sql       # D1 建表语句
│   └── utils/
│       └── response.ts      # 统一响应格式
├── public/                  # 前端静态文件
│   ├── index.html           # 主页面
│   ├── style.css            # 样式
│   └── app.js               # 前端逻辑
├── wrangler.toml            # Cloudflare 配置（非敏感值）
├── .env.example             # 环境变量模板（可提交 Git）
├── .env                     # 本地环境变量（不提交 Git）
├── tsconfig.json            # TypeScript 配置
├── package.json             # 依赖管理
├── Dockerfile               # Oracle Cloud 容器化
├── docker-compose.yml       # 本地容器编排
└── .gitignore
```

## 请求流

```
浏览器 ──→ Cloudflare Worker (Hono)
              ├── /auth/*     → 认证路由 (注册/登录/登出)
              ├── /api/*      → API 路由（未来扩展）
              └── /*           → 静态文件（public/）
                  
数据层：
  认证 ──→ D1 (users 表, sessions 表)
  Session ──→ KV 或 httpOnly Cookie (JWT)
```

## 安全设计

- 密码使用 bcrypt (cost=10) 哈希存储
- JWT 通过 httpOnly Secure SameSite Cookie 传输
- CORS 限定白名单
- Zod 校验所有输入
- SQL 参数化查询防注入（D1 原生支持）

## 配置管理

### 三层分离

| 层级 | 存储位置 | 管理方式 |
|------|---------|---------|
| **非敏感配置** | `wrangler.toml` `[vars]` | Git 版本控制 |
| **敏感配置（本地）** | `.env` 文件 | 不提交 Git，wrangler dev 自动读取 |
| **敏感配置（生产）** | Cloudflare Secrets | `wrangler secret put <KEY>` 加密存储 |

### 敏感配置清单

| Key | 用途 | 环境 |
|-----|------|------|
| `JWT_SECRET` | JWT 签名密钥 | 本地+生产 |
| `GOOGLE_CLIENT_ID` | Google OAuth (未来) | 本地+生产 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (未来) | 本地+生产 |
| `CLOUDFLARE_API_TOKEN` | CI/CD 部署 | GitHub Secrets |

> Helm Chart 在 Oracle Cloud / Kubernetes 阶段才会使用（Phase 4+）。当前阶段 Helm 没有必要。

## 扩展点

### Google SSO 扩展点
- `users` 表已预留 `provider`, `google_id`, `avatar_url` 字段
- `POST /auth/google` 路由入口已规划
- 通过 `provider` 字段区分邮箱登录 / Google 登录用户
- 同邮箱自动关联账号

### 功能扩展点
- `/api/*` 路由前缀已预留
- 前端 SPA 框架可无缝替换（Vanilla → React/Vue）
- D1 可替换为 PostgreSQL（Oracle Cloud 场景）
