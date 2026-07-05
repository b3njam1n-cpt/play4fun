import type { Context } from 'hono';
import type { ApiResponse } from '../types';

/**
 * 成功响应
 */
export function success<T>(
  c: Context,
  data: T,
  message = 'OK',
  status = 200,
) {
  const body: ApiResponse<T> = { success: true, message, data };
  return c.json(body, { status } as any);
}

/**
 * 错误响应
 */
export function error(
  c: Context,
  status: number,
  code: string,
  details: Record<string, unknown> = {},
  message?: string,
) {
  const body: ApiResponse<null> = {
    success: false,
    message: message || code,
    error: { code, details },
  };
  return c.json(body, { status } as any);
}
