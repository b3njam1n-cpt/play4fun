import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

/**
 * Cloudflare Worker 环境变量和绑定
 */
export interface AppEnv {
  Bindings: {
    ENVIRONMENT: string;
    JWT_SECRET: string;
    DB?: D1Database;         // D1 数据库绑定（生产环境）
    KV?: KVNamespace;        // KV 命名空间绑定
    AI?: any;                // Workers AI binding（生产环境）
    DEEPSEEK_API_KEY?: string;  // DeepSeek API key
    GEMINI_API_KEY?: string; // Gemini API key（可选）
    CF_LOCAL_ACCOUNT_ID?: string;  // Cloudflare Account ID（本地开发用）
    CF_LOCAL_API_TOKEN?: string;   // Cloudflare API Token（本地开发用）
    CF_ACCOUNT_ID?: string;        // Cloudflare Account ID（生产环境 wrangler.toml vars）
    CF_AI_GATEWAY_ID?: string;     // AI Gateway 名称（绕过 Gemini 地区限制）
  };
  Variables: {
    userId?: string;     // JWT 中间件注入当前用户 ID
    userRole?: string;   // Admin 中间件注入角色 'user' | 'admin'
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
