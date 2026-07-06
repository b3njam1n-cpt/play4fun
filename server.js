// ============================================================
// play4fun — Node.js 运行入口（本地开发 + Docker 部署）
// 运行命令：npx tsx server.js
// ============================================================

import { serve } from '@hono/node-server';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import bcrypt from 'bcryptjs';
import app from './src/index.ts';
import { localDB } from './src/db/local-store.ts';

// ── 静态文件服务 ────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
};

function servePublic(pathname) {
  const filename = pathname === '/' ? '/index.html' : pathname;
  const filePath = join('./public', filename);

  if (!filePath.startsWith('public')) return null;
  if (!existsSync(filePath)) return null;

  const ext = extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  const content = readFileSync(filePath);
  return new Response(content, {
    status: 200,
    headers: { 'Content-Type': mime },
  });
}

// ── 种子数据：测试用户 ──────────────────────────
async function seedTestUser() {
  const testEmail = 'test@example.com';
  const testPassword = 'test1234';
  const testName = 'Tester';

  const existing = localDB.getUserByEmail(testEmail);
  if (existing) {
    console.log(`📝 测试用户已存在: ${testEmail} / ${testPassword}`);
    return;
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await bcrypt.hash(testPassword, 10);

  localDB.createUser({
    id,
    email: testEmail,
    password_hash: passwordHash,
    provider: 'email',
    google_id: null,
    github_id: null,
    display_name: testName,
    avatar_url: null,
    created_at: now,
    updated_at: now,
  });

  console.log(`✅ 测试用户已创建:`);
  console.log(`   📧 邮箱: ${testEmail}`);
  console.log(`   🔑 密码: ${testPassword}`);
  console.log(`   👤 昵称: ${testName}`);
}

// ── 启动 ────────────────────────────────────────
const port = process.env.PORT || 3000;

// 先种种子，再启动服务
seedTestUser().then(() => {
  serve({
    fetch: (request) => {
      const url = new URL(request.url);

      // 静态文件优先（非 API 路径）
      if (!url.pathname.startsWith('/auth') && url.pathname !== '/api/health') {
        const staticResponse = servePublic(url.pathname);
        if (staticResponse) return staticResponse;
      }

      // 回退到 Hono 应用
      return app.fetch(request);
    },
    port,
  });

  console.log(`🚀 play4fun 本地开发服务器启动: http://localhost:${port}`);
  console.log(`📝 测试用户: test@example.com / test1234`);
});
