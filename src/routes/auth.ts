import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { success, error } from '../utils/response';
import { localDB } from '../db/local-store';
import {
  JWT_FALLBACK_SECRET,
  JWT_EXPIRY,
  JWT_ALGORITHM,
  BCRYPT_COST,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  COOKIE_OPTIONS,
  COOKIE_CLEAR,
} from '../utils/constants';
import type { AppEnv } from '../types';

export const authRoutes = new Hono<AppEnv>();

// ── 输入校验 ────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('email_invalid'),
  password: z.string().min(8, 'password_too_short'),
  display_name: z.string().min(1).max(50).optional(),
});

const loginSchema = z.object({
  email: z.string().email('email_invalid'),
  password: z.string().min(1, 'password_required'),
});

// ── JWT ─────────────────────────────────────────

function getJwtSecret(env: AppEnv['Bindings']): string {
  return env.JWT_SECRET || JWT_FALLBACK_SECRET;
}

/**
 * 创建 JWT，包含 sub (userId) 和 jti (token 唯一标识)
 * jti 用于服务端 Session 管理和注销
 */
async function createToken(userId: string, env: AppEnv['Bindings']): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID();
  const secret = new TextEncoder().encode(getJwtSecret(env));
  const token = await new SignJWT({ sub: userId, jti })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secret);
  return { token, jti };
}

// ── 数据访问抽象（D1 优先，本地内存回退）───────

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  provider: string;
  google_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: number;
}

async function findUserByEmail(email: string, db?: D1Database): Promise<UserRow | null> {
  if (db) {
    return await db.prepare(
      'SELECT id, email, password_hash, provider, google_id, display_name, avatar_url, created_at FROM users WHERE email = ?'
    ).bind(email).first<UserRow>();
  }
  const user = localDB.getUserByEmail(email);
  return user ? { ...user, password_hash: user.password_hash ?? null } : null;
}

async function findUserById(id: string, db?: D1Database): Promise<UserRow | null> {
  if (db) {
    return await db.prepare(
      'SELECT id, email, password_hash, provider, google_id, display_name, avatar_url, created_at FROM users WHERE id = ?'
    ).bind(id).first<UserRow>();
  }
  const user = localDB.getUserById(id);
  return user ? { ...user, password_hash: user.password_hash ?? null } : null;
}

/**
 * 写入 Session 记录（D1 + 本地回退）
 */
function createSession(params: {
  sessionId: string;
  userId: string;
  tokenJti: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: number;
  now: number;
}, db?: D1Database): void {
  if (db) {
    db.prepare(`
      INSERT INTO sessions (id, user_id, token_jti, user_agent, ip_address, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      params.sessionId, params.userId, params.tokenJti,
      params.userAgent, params.ipAddress,
      params.expiresAt, params.now
    ).run();
    return;
  }
  // 本地开发：记录到内存（简化版，仅用于调试）
  localDB.createSession({
    id: params.sessionId,
    user_id: params.userId,
    token_jti: params.tokenJti,
    user_agent: params.userAgent,
    ip_address: params.ipAddress,
    expires_at: params.expiresAt,
    created_at: params.now,
  });
}

/** 统一的用户响应格式，所有返回用户数据的地方都用这个 */
function userResponse(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    provider: user.provider,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    created_at: new Date(user.created_at * 1000).toISOString(),
  };
}

// ── POST /auth/register ─────────────────────────

authRoutes.post('/register', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return error(c, 400, 'invalid_json', {});
  }

  const result = registerSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return error(c, 400, firstIssue.message, { field: firstIssue.path.join('.') });
  }

  const { email, password, display_name } = result.data;

  // 检查邮箱是否已存在
  const existing = await findUserByEmail(email, c.env.DB);
  if (existing) {
    return error(c, 409, 'email_exists', {});
  }

  // 创建用户
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const newUser: UserRow = {
    id,
    email,
    password_hash: passwordHash,
    provider: 'email',
    google_id: null,
    display_name: display_name || null,
    avatar_url: null,
    created_at: now,
  };

  // 写入 D1（生产）或本地内存（开发）
  if (c.env.DB) {
    try {
      await c.env.DB.prepare(`
        INSERT INTO users (id, email, password_hash, provider, display_name, created_at, updated_at)
        VALUES (?, ?, ?, 'email', ?, ?, ?)
      `).bind(id, email, passwordHash, display_name || null, now, now).run();
    } catch (e) {
      console.error('D1 insert user failed:', e);
      return error(c, 500, 'db_error', {});
    }
  }
  localDB.createUser({
    id,
    email,
    password_hash: passwordHash,
    provider: 'email',
    google_id: null,
    github_id: null,
    display_name: display_name || null,
    avatar_url: null,
    created_at: now,
    updated_at: now,
  });

  // 生成 JWT + Session
  const { token, jti } = await createToken(id, c.env);
  createSession({
    sessionId: crypto.randomUUID(),
    userId: id,
    tokenJti: jti,
    userAgent: c.req.header('User-Agent') || null,
    ipAddress: c.req.header('CF-Connecting-IP') || null,
    expiresAt: now + COOKIE_MAX_AGE,
    now,
  }, c.env.DB);

  c.header('Set-Cookie', `${COOKIE_NAME}=${token}; ${COOKIE_OPTIONS}`);

  return success(c, {
    token,
    user: userResponse(newUser),
  }, '注册成功', 201);
});

// ── POST /auth/login ────────────────────────────

authRoutes.post('/login', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return error(c, 400, 'invalid_json', {});
  }

  const result = loginSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return error(c, 400, firstIssue.message, { field: firstIssue.path.join('.') });
  }

  const { email, password } = result.data;

  // 查找用户
  const user = await findUserByEmail(email, c.env.DB);

  if (!user || !user.password_hash) {
    return error(c, 401, 'invalid_credentials', {});
  }

  // 验证密码
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return error(c, 401, 'invalid_credentials', {});
  }

  // 生成 JWT + Session
  const now = Math.floor(Date.now() / 1000);
  const { token, jti } = await createToken(user.id, c.env);
  createSession({
    sessionId: crypto.randomUUID(),
    userId: user.id,
    tokenJti: jti,
    userAgent: c.req.header('User-Agent') || null,
    ipAddress: c.req.header('CF-Connecting-IP') || null,
    expiresAt: now + COOKIE_MAX_AGE,
    now,
  }, c.env.DB);

  c.header('Set-Cookie', `${COOKIE_NAME}=${token}; ${COOKIE_OPTIONS}`);

  return success(c, {
    token,
    user: userResponse(user),
  }, '登录成功');
});

// ── POST /auth/logout ───────────────────────────

authRoutes.post('/logout', async (c) => {
  c.header('Set-Cookie', COOKIE_CLEAR);
  return success(c, null, '已登出');
});

// ── POST /auth/reset-password ───────────────────

const resetPasswordSchema = z.object({
  email: z.string().email('email_invalid'),
  new_password: z.string().min(8, 'password_too_short'),
  username: z.string().min(1, 'username_required'),
});

authRoutes.post('/reset-password', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return error(c, 400, 'invalid_json', {});
  }

  const result = resetPasswordSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return error(c, 400, firstIssue.message, { field: firstIssue.path.join('.') });
  }

  const { email, new_password, username } = result.data;

  // 查找用户（必须邮箱 + 用户名都匹配）
  const user = await findUserByEmail(email, c.env.DB);
  if (!user || !user.password_hash) {
    return error(c, 404, 'user_not_found', {});
  }

  // 验证用户名
  if (user.display_name !== username) {
    return error(c, 401, 'username_mismatch', {});
  }

  // 更新密码
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await bcrypt.hash(new_password, BCRYPT_COST);

  if (c.env.DB) {
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
    ).bind(passwordHash, now, user.id).run();
  }

  // 同步更新本地存储
  const localUser = localDB.getUserById(user.id);
  if (localUser) {
    localUser.password_hash = passwordHash;
    localUser.updated_at = now;
  }

  return success(c, null, '密码修改成功，请重新登录');
});

// ── GET /auth/me ────────────────────────────────

authRoutes.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return error(c, 401, 'unauthorized', {});
  }

  const user = await findUserById(userId, c.env.DB);
  if (!user) {
    return error(c, 404, 'user_not_found', {});
  }

  return success(c, userResponse(user));
});
