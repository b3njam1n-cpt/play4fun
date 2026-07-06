import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import { JWT_FALLBACK_SECRET } from '../utils/constants';
import type { AppEnv } from '../types';
import { error } from '../utils/response';

/**
 * JWT 认证中间件
 *
 * 验证顺序：
 * 1. Cookie 中的 token
 * 2. Authorization: Bearer <token>  （优先级更高）
 *
 * 验证通过后将 userId 注入到 c.set('userId', ...)
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
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

    c.set('userId', payload.sub);
    await next();
  } catch {
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
