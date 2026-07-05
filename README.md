# play4fun

个人主页应用，部署在 Cloudflare Workers。

**线上: https://vieplay4fun.win**

## 技术栈

- **后端:** Hono 4.x + TypeScript (Cloudflare Workers)
- **数据库:** Cloudflare D1 (SQLite)
- **前端:** Vanilla JS + Tailwind CSS
- **认证:** bcrypt + JWT (jose)，未来扩展 Google OAuth SSO

## 开发

```bash
npm install
npm run dev       # localhost:8787
npm run deploy    # 部署到 Cloudflare
```

## 文档

- [架构设计](docs/01-architecture.md)
- [API 接口](docs/02-api-auth.md)
- [数据库设计](docs/03-database-schema.md)
- [路线图](docs/04-roadmap.md)
