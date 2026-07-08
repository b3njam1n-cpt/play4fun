import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import { JWT_FALLBACK_SECRET } from '../utils/constants';
import { localDB } from '../db/local-store';
import type { AppEnv } from '../types';
import { error } from '../utils/response';

/**
 * Admin 认证中间件
 *
 * 验证顺序：
 * 1. Cookie 中的 token
 * 2. Authorization: Bearer <token>（优先级更高）
 * 3. 验证通过后查询用户 role，必须是 'admin'
 *
 * 通过后注入：
 * - c.set('userId', userId)
 * - c.set('userRole', 'admin')
 */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  let token: string | undefined;

  // 从 Cookie 获取
  const cookieHeader = c.req.header('Cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    token = cookies.token;
  }

  // 从 Authorization header 获取（优先级更高）
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    return error(c, 401, 'unauthorized', { reason: 'no_token' });
  }

  try {
    const secret = new TextEncoder().encode(
      c.env.JWT_SECRET || JWT_FALLBACK_SECRET
    );
    const { payload } = await jwtVerify(token, secret);

    if (!payload.sub) {
      return error(c, 401, 'unauthorized', { reason: 'invalid_payload' });
    }

    const userId = payload.sub;

    // 查询用户角色
    let userRole: string | undefined;
    if (c.env.DB) {
      const user = await c.env.DB.prepare(
        'SELECT role FROM users WHERE id = ?'
      ).bind(userId).first<{ role: string }>();
      userRole = user?.role;
    } else {
      const user = localDB.getUserById(userId);
      userRole = user?.role;
    }

    if (!userRole || userRole !== 'admin') {
      return error(c, 403, 'forbidden', { reason: 'not_admin' });
    }

    c.set('userId', userId);
    c.set('userRole', 'admin');
    await next();
  } catch (e) {
    // jwtVerify 错误 + 其他异常
    if (e instanceof Error && e.name === 'JWTExpired') {
      return error(c, 401, 'unauthorized', { reason: 'token_expired' });
    }
    return error(c, 401, 'unauthorized', { reason: 'token_expired_or_invalid' });
  }
});

/**
 * 简易 Cookie 解析
 */
function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  header.split(';').forEach((pair) => {
    const [name, ...rest] = pair.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(rest.join('='));
    }
  });
  return cookies;
}
