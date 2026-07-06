import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import { chatRoutes } from './routes/chat';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

// ── Gemini 反向代理（解决 Google API 地域限制）───
app.all('*', async (c, next) => {
  const host = c.req.header('Host') || '';
  if (host.startsWith('ai-studio.')) {
    const url = new URL(c.req.url);
    url.host = 'generativelanguage.googleapis.com';
    const newReq = new Request(url, {
      method: c.req.method,
      headers: c.req.raw ? c.req.raw.headers : new Headers(),
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.text().catch(() => undefined) : undefined,
    });
    newReq.headers.set('Host', 'generativelanguage.googleapis.com');
    newReq.headers.delete('Origin');
    newReq.headers.delete('Referer');
    return fetch(newReq);
  }
  await next();
});

// ── 全局中间件 ──────────────────────────────────
app.use('*', cors({
  origin: '*',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 本地开发环境：注入默认 Bindings（Cloudflare Workers 由平台自动注入）
app.use('*', async (c, next) => {
  if (!c.env) {
    // @ts-ignore - Node.js 本地开发：从 process.env 读取环境变量
    const processEnv = typeof process !== 'undefined' ? process.env : {};
    (c as any).env = {
      ENVIRONMENT: 'development',
      JWT_SECRET: undefined,
      DB: undefined,
      DEEPSEEK_API_KEY: processEnv.DEEPSEEK_API_KEY,
      GEMINI_API_KEY: processEnv.GEMINI_API_KEY,
      CF_LOCAL_ACCOUNT_ID: processEnv.CF_LOCAL_ACCOUNT_ID,
      CF_LOCAL_API_TOKEN: processEnv.CF_LOCAL_API_TOKEN,
      AI: undefined,
    };
  }
  await next();
});

// ── API 路由 ────────────────────────────────────
app.route('/auth', authRoutes);
app.route('/api', chatRoutes);

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// ── 404 兜底 ────────────────────────────────────
app.notFound((c) => {
  return c.json({ success: false, message: 'Not Found' }, 404);
});

// ── 全局错误处理 ────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    success: false,
    message: 'Internal Server Error',
    error: { code: 'internal_error', details: {} },
  }, 500);
});

export default app;
