/**
 * 共享常量
 * 避免在多个文件中硬编码相同的值
 */

/** JWT 相关 */
export const JWT_FALLBACK_SECRET = 'dev-secret-change-in-production-please';
export const JWT_EXPIRY = '4h';
export const JWT_ALGORITHM = 'HS256';
export const BCRYPT_COST = 10;

/** Cookie 相关 */
export const COOKIE_NAME = 'token';
export const COOKIE_MAX_AGE = 14400; // 4 小时（秒）
export const COOKIE_OPTIONS = `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
export const COOKIE_CLEAR = `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
