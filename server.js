// ============================================================
// play4fun — Node.js 运行入口（本地开发 + Docker 部署）
// 运行命令：npx tsx server.js
// ============================================================

import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import bcrypt from 'bcryptjs';
import app from './src/index.ts';
import { localDB } from './src/db/local-store.ts';

// ── 加载 .env 文件（Wrangler 自动，Node.js 手动）───
// 优先读 .env（明文），不存在则从 .env.gpg 解密
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '.env');
const envGpgPath = resolve(__dirname, '.env.gpg');

function loadEnv(content) {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

try {
  // 1. 尝试读明文 .env
  loadEnv(readFileSync(envPath, 'utf-8'));
  console.log('📄 .env 文件已加载');
} catch {
  try {
    // 2. 尝试解密 .env.gpg
    const decrypted = execSync(`gpg --decrypt --batch --quiet "${envGpgPath}"`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    loadEnv(decrypted);
    console.log('🔐 .env.gpg 已解密加载');
  } catch {
    console.log('⚠️  未找到 .env 或 .env.gpg 文件');
  }
}

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
