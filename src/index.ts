import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

// ── 全局中间件 ──────────────────────────────────
app.use('*', cors({
  origin: '*',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ── API 路由 ────────────────────────────────────
app.route('/auth', authRoutes);

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
