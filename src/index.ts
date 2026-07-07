import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import { chatRoutes } from './routes/chat';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

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
      CF_ACCOUNT_ID: processEnv.CF_ACCOUNT_ID,
      CF_AI_GATEWAY_ID: processEnv.CF_AI_GATEWAY_ID,
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
