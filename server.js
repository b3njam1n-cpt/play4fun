// ============================================================
// play4fun — Node.js 运行入口（Docker / Oracle Cloud 部署）
// ⚠️ Phase 4 启用，当前为占位文件。
//
// 启用步骤：
//   1. npm install @hono/node-server tsx
//   2. 将 D1 查询适配为 SQLite（better-sqlite3）或 PostgreSQL（pg）
//   3. docker compose up
//
// 运行命令：npx tsx server.js
// ============================================================

import { serve } from '@hono/node-server';
import app from './src/index';

const port = process.env.PORT || 3000;

console.log(`🚀 play4fun server running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
