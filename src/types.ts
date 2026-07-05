import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

/**
 * Cloudflare Worker 环境变量和绑定
 */
export interface AppEnv {
  Bindings: {
    ENVIRONMENT: string;
    JWT_SECRET: string;
    DB?: D1Database;     // D1 数据库绑定（生产环境）
    KV?: KVNamespace;    // KV 命名空间绑定
  };
  Variables: {
    userId?: string;     // JWT 中间件注入当前用户 ID
  };
}

/**
 * 统一 API 响应格式
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details: Record<string, unknown>;
  };
}
