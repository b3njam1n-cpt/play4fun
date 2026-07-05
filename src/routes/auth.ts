import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { success, error } from '../utils/response';
import { localDB } from '../db/local-store';
import type { AppEnv } from '../types';

export const authRoutes = new Hono<AppEnv>();

// ── 输入校验 ────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('email_invalid'),
  password: z.string().min(8, 'password_too_short'),
});

const loginSchema = z.object({
  email: z.string().email('email_invalid'),
  password: z.string().min(1, 'password_required'),
});

// ── JWT 密钥 ────────────────────────────────────
function getJwtSecret(env: AppEnv['Bindings']): string {
  return env.JWT_SECRET || 'dev-secret-change-in-production-please';
}

const JWT_EXPIRY = '24h';

async function createToken(userId: string, env: AppEnv['Bindings']): Promise<string> {
  const secret = new TextEncoder().encode(getJwtSecret(env));
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secret);
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
  // 本地内存回退
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

function emailExists(email: string, db?: D1Database): boolean {
  if (db) {
    // 注意：这个同步调用在 D1 场景下不可用，实际使用 findUserByEmail
    return false;
  }
  return localDB.emailExists(email);
}

function createUserInStore(user: UserRow, db?: D1Database): void {
  if (db) {
    // D1 场景使用 prepare().run()
    return;
  }
  localDB.createUser({
    id: user.id,
    email: user.email,
    password_hash: user.password_hash,
    provider: user.provider,
    google_id: user.google_id,
    github_id: null,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    updated_at: user.created_at,
  });
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

  const { email, password } = result.data;

  // 检查邮箱是否已存在
  const existing = await findUserByEmail(email, c.env.DB);
  if (existing) {
    return error(c, 409, 'email_exists', {});
  }

  // 创建用户
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await bcrypt.hash(password, 10);

  const newUser: UserRow = {
    id,
    email,
    password_hash: passwordHash,
    provider: 'email',
    google_id: null,
    display_name: null,
    avatar_url: null,
    created_at: now,
  };

  // 双重写入：D1 + 本地回退
  if (c.env.DB) {
    await c.env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, provider, created_at, updated_at)
      VALUES (?, ?, ?, 'email', ?, ?)
    `).bind(id, email, passwordHash, now, now).run();
  }
  createUserInStore(newUser, c.env.DB);

  // 生成 JWT
  const token = await createToken(id, c.env);
  c.header('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`);

  return success(c, {
    id,
    email,
    created_at: new Date(now * 1000).toISOString(),
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

  // 查找用户（D1 或本地回退）
  const user = await findUserByEmail(email, c.env.DB);

  if (!user || !user.password_hash) {
    return error(c, 401, 'invalid_credentials', {});
  }

  // 验证密码
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return error(c, 401, 'invalid_credentials', {});
  }

  // 生成 JWT
  const token = await createToken(user.id, c.env);
  c.header('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`);

  return success(c, {
    token,
    user: {
      id: user.id,
      email: user.email,
      provider: user.provider,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
    },
  }, '登录成功');
});

// ── POST /auth/logout ───────────────────────────

authRoutes.post('/logout', async (c) => {
  c.header('Set-Cookie', 'token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  return success(c, null, '已登出');
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

  return success(c, {
    id: user.id,
    email: user.email,
    provider: user.provider,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    created_at: new Date(user.created_at * 1000).toISOString(),
  });
});
