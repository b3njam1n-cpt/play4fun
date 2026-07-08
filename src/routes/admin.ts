import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAdmin } from '../middleware/admin';
import { success, error } from '../utils/response';
import { localDB } from '../db/local-store';
import { BCRYPT_COST } from '../utils/constants';
import type { AppEnv } from '../types';

export const adminRoutes = new Hono<AppEnv>();

// 所有路由都要求 admin 权限
adminRoutes.use('*', requireAdmin);

// ── 输入校验 ────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email('email_invalid'),
  password: z.string().min(8, 'password_too_short'),
  display_name: z.string().min(1).max(50).optional(),
  role: z.enum(['user', 'admin']).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email('email_invalid').optional(),
  display_name: z.string().min(1).max(50).optional(),
  role: z.enum(['user', 'admin']).optional(),
});

// ── 数据访问 ────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  provider: string;
  role: string;
  google_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
}

interface SessionRow {
  id: string;
  user_id: string;
  token_jti: string;
  user_agent: string | null;
  ip_address: string | null;
  expires_at: number;
  created_at: number;
}

function userToResponse(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    provider: user.provider,
    role: user.role,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    created_at: new Date(user.created_at * 1000).toISOString(),
    updated_at: new Date(user.updated_at * 1000).toISOString(),
  };
}

/** 查找用户 by ID（D1 优先，本地回退） */
async function findUserById(id: string, db?: D1Database): Promise<UserRow | null> {
  if (db) {
    return await db.prepare(
      'SELECT id, email, password_hash, provider, role, google_id, display_name, avatar_url, created_at, updated_at FROM users WHERE id = ?'
    ).bind(id).first<UserRow>();
  }
  const user = localDB.getUserById(id);
  if (!user) return null;
  return {
    ...user,
    password_hash: user.password_hash ?? null,
    updated_at: user.updated_at,
    role: user.role,
  };
}

/** 写入审计日志 */
async function writeAuditLog(params: {
  adminId: string;
  action: string;
  targetUserId?: string;
  details?: Record<string, unknown>;
  ipAddress: string | null;
  db?: D1Database;
}) {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const detailsJson = params.details ? JSON.stringify(params.details) : null;

  if (params.db) {
    await params.db.prepare(`
      INSERT INTO admin_audit_log (id, admin_id, action, target_user_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, params.adminId, params.action, params.targetUserId || null, detailsJson, params.ipAddress, now).run();
  }

  // 同步写本地存储
  localDB.createAuditLog({
    id,
    admin_id: params.adminId,
    action: params.action,
    target_user_id: params.targetUserId || null,
    details: detailsJson,
    ip_address: params.ipAddress,
    created_at: now,
  });
}

// ══════════════════════════════════════════════════
// GET /admin/api/stats
// ══════════════════════════════════════════════════

adminRoutes.get('/stats', async (c) => {
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);
  const todayStart = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 1000);

  let totalUsers = 0;
  let todayNew = 0;
  let adminCount = 0;
  let activeSessionCount = 0;

  if (db) {
    const totalResult = await db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
    totalUsers = totalResult?.count ?? 0;

    const todayResult = await db.prepare('SELECT COUNT(*) as count FROM users WHERE created_at >= ?').bind(todayStart).first<{ count: number }>();
    todayNew = todayResult?.count ?? 0;

    const adminResult = await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>();
    adminCount = adminResult?.count ?? 0;

    const sessResult = await db.prepare('SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?').bind(now).first<{ count: number }>();
    activeSessionCount = sessResult?.count ?? 0;
  } else {
    totalUsers = localDB._count().users;
    todayNew = localDB.getAllUsers({ search: '', limit: 10000 }).users.filter(u => u.created_at >= todayStart).length;
    adminCount = localDB.countAdmins();
    activeSessionCount = localDB.countActiveSessions();
  }

  return success(c, { totalUsers, todayNew, adminCount, activeSessionCount });
});

// ══════════════════════════════════════════════════
// GET /admin/api/users
// ══════════════════════════════════════════════════

adminRoutes.get('/users', async (c) => {
  const search = c.req.query('search') || '';
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));
  const db = c.env.DB;

  let users: UserRow[] = [];
  let total = 0;

  if (db) {
    if (search) {
      const q = `%${search}%`;
      total = (await db.prepare(
        'SELECT COUNT(*) as count FROM users WHERE email LIKE ? OR display_name LIKE ?'
      ).bind(q, q).first<{ count: number }>())?.count ?? 0;

      users = (await db.prepare(
        'SELECT id, email, password_hash, provider, role, google_id, display_name, avatar_url, created_at, updated_at FROM users WHERE email LIKE ? OR display_name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).bind(q, q, limit, (page - 1) * limit).all<UserRow>()).results ?? [];
    } else {
      total = (await db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>())?.count ?? 0;

      users = (await db.prepare(
        'SELECT id, email, password_hash, provider, role, google_id, display_name, avatar_url, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).bind(limit, (page - 1) * limit).all<UserRow>()).results ?? [];
    }
  } else {
    const result = localDB.getAllUsers({ search, page, limit });
    users = result.users.map(u => ({
      ...u,
      password_hash: u.password_hash ?? null,
      updated_at: u.updated_at,
    }));
    total = result.total;
  }

  return success(c, {
    users: users.map(userToResponse),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// ══════════════════════════════════════════════════
// GET /admin/api/users/:id
// ══════════════════════════════════════════════════

adminRoutes.get('/users/:id', async (c) => {
  const userId = c.req.param('id');
  const db = c.env.DB;

  const user = await findUserById(userId, db);
  if (!user) {
    return error(c, 404, 'user_not_found', {});
  }

  let sessions: SessionRow[] = [];
  if (db) {
    sessions = (await db.prepare(
      'SELECT id, user_id, token_jti, user_agent, ip_address, expires_at, created_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC'
    ).bind(userId, Math.floor(Date.now() / 1000)).all<SessionRow>()).results ?? [];
  } else {
    sessions = localDB.getSessionsByUserId(userId);
  }

  return success(c, {
    user: userToResponse(user),
    sessions: sessions.map(s => ({
      id: s.id,
      user_agent: s.user_agent,
      ip_address: s.ip_address,
      expires_at: new Date(s.expires_at * 1000).toISOString(),
      created_at: new Date(s.created_at * 1000).toISOString(),
    })),
  });
});

// ══════════════════════════════════════════════════
// POST /admin/api/users
// ══════════════════════════════════════════════════

adminRoutes.post('/users', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return error(c, 400, 'invalid_json', {});
  }

  const result = createUserSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return error(c, 400, firstIssue.message, { field: firstIssue.path.join('.') });
  }

  const { email, password, display_name, role = 'user' } = result.data;
  const adminId = c.get('userId')!;
  const db = c.env.DB;

  // 检查邮箱是否已存在
  let emailExists = false;
  if (db) {
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    emailExists = !!existing;
  } else {
    emailExists = !!localDB.getUserByEmail(email);
  }
  if (emailExists) {
    return error(c, 409, 'email_exists', {});
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  if (db) {
    await db.prepare(`
      INSERT INTO users (id, email, password_hash, provider, role, display_name, created_at, updated_at)
      VALUES (?, ?, ?, 'email', ?, ?, ?, ?)
    `).bind(id, email, passwordHash, role, display_name || null, now, now).run();
  }

  localDB.createUser({
    id,
    email,
    password_hash: passwordHash,
    provider: 'email',
    role,
    google_id: null,
    github_id: null,
    display_name: display_name || null,
    avatar_url: null,
    created_at: now,
    updated_at: now,
  });

  // 审计日志
  await writeAuditLog({
    adminId,
    action: 'create_user',
    targetUserId: id,
    details: { email, display_name: display_name || null, role },
    ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null,
    db,
  });

  const newUser = await findUserById(id, db);
  return success(c, { user: userToResponse(newUser!) }, '用户创建成功', 201);
});

// ══════════════════════════════════════════════════
// PUT /admin/api/users/:id
// ══════════════════════════════════════════════════

adminRoutes.put('/users/:id', async (c) => {
  const targetId = c.req.param('id');
  const adminId = c.get('userId')!;
  const db = c.env.DB;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return error(c, 400, 'invalid_json', {});
  }

  const result = updateUserSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return error(c, 400, firstIssue.message, { field: firstIssue.path.join('.') });
  }

  const updates = result.data;
  if (Object.keys(updates).length === 0) {
    return error(c, 400, 'no_fields', {});
  }

  // 查找目标用户
  const targetUser = await findUserById(targetId, db);
  if (!targetUser) {
    return error(c, 404, 'user_not_found', {});
  }

  // ── 安全规则 ──

  // 不能修改自己的角色
  if (updates.role !== undefined && targetId === adminId) {
    return error(c, 403, 'cannot_demote_self', {});
  }

  // 不能把最后一个 admin 降级
  if (updates.role === 'user' && targetUser.role === 'admin') {
    let adminCount = 0;
    if (db) {
      adminCount = (await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>())?.count ?? 0;
    } else {
      adminCount = localDB.countAdmins();
    }
    if (adminCount <= 1) {
      return error(c, 403, 'last_admin', {});
    }
  }

  // 检查邮箱唯一性
  if (updates.email) {
    let emailExists = false;
    if (db) {
      const existing = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(updates.email, targetId).first();
      emailExists = !!existing;
    } else {
      const byEmail = localDB.getUserByEmail(updates.email);
      emailExists = !!(byEmail && byEmail.id !== targetId);
    }
    if (emailExists) {
      return error(c, 409, 'email_exists', {});
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const before = {
    email: targetUser.email,
    display_name: targetUser.display_name,
    role: targetUser.role,
  };

  // 执行更新
  if (db) {
    const setClauses: string[] = [];
    const params: (string | number)[] = [];

    if (updates.email !== undefined) { setClauses.push('email = ?'); params.push(updates.email); }
    if (updates.display_name !== undefined) { setClauses.push('display_name = ?'); params.push(updates.display_name); }
    if (updates.role !== undefined) { setClauses.push('role = ?'); params.push(updates.role); }

    setClauses.push('updated_at = ?'); params.push(now);
    params.push(targetId);

    await db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  localDB.updateUser(targetId, {
    ...updates,
    updated_at: now,
  });

  const updatedUser = await findUserById(targetId, db);

  // 审计日志
  const after = {
    email: updatedUser!.email,
    display_name: updatedUser!.display_name,
    role: updatedUser!.role,
  };

  const action = updates.role !== undefined && updates.role !== before.role
    ? 'change_role'
    : 'update_user';

  await writeAuditLog({
    adminId,
    action,
    targetUserId: targetId,
    details: { before, after },
    ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null,
    db,
  });

  return success(c, { user: userToResponse(updatedUser!) }, '用户更新成功');
});

// ══════════════════════════════════════════════════
// DELETE /admin/api/users/:id
// ══════════════════════════════════════════════════

adminRoutes.delete('/users/:id', async (c) => {
  const targetId = c.req.param('id');
  const adminId = c.get('userId')!;
  const db = c.env.DB;

  // 不能删除自己
  if (targetId === adminId) {
    return error(c, 403, 'cannot_delete_self', {});
  }

  // 查找目标用户（用于审计日志）
  const targetUser = await findUserById(targetId, db);
  if (!targetUser) {
    return error(c, 404, 'user_not_found', {});
  }

  // 不能删除最后一个 admin
  if (targetUser.role === 'admin') {
    let adminCount = 0;
    if (db) {
      adminCount = (await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>())?.count ?? 0;
    } else {
      adminCount = localDB.countAdmins();
    }
    if (adminCount <= 1) {
      return error(c, 403, 'last_admin', {});
    }
  }

  if (db) {
    await db.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();
  }
  localDB.deleteUser(targetId);

  // 审计日志
  await writeAuditLog({
    adminId,
    action: 'delete_user',
    targetUserId: targetId,
    details: {
      deleted_user: {
        email: targetUser.email,
        display_name: targetUser.display_name,
        role: targetUser.role,
      },
    },
    ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null,
    db,
  });

  return success(c, null, '用户已删除');
});

// ══════════════════════════════════════════════════
// GET /admin/api/audit-logs
// ══════════════════════════════════════════════════

adminRoutes.get('/audit-logs', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50')));
  const db = c.env.DB;

  type AuditLogRow = {
    id: string;
    admin_id: string;
    action: string;
    target_user_id: string | null;
    details: string | null;
    ip_address: string | null;
    created_at: number;
  };

  let logs: AuditLogRow[] = [];
  let total = 0;

  if (db) {
    total = (await db.prepare('SELECT COUNT(*) as count FROM admin_audit_log').first<{ count: number }>())?.count ?? 0;

    logs = (await db.prepare(
      'SELECT id, admin_id, action, target_user_id, details, ip_address, created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(limit, (page - 1) * limit).all<AuditLogRow>()).results ?? [];
  } else {
    const result = localDB.getAuditLogs({ page, limit });
    logs = result.logs;
    total = result.total;
  }

  // 批量查找 admin 用户信息
  const adminIds = [...new Set(logs.map(l => l.admin_id))];
  const adminUsers: Record<string, { email: string; display_name: string | null }> = {};

  for (const aid of adminIds) {
    if (db) {
      const u = await db.prepare('SELECT email, display_name FROM users WHERE id = ?').bind(aid).first<{ email: string; display_name: string | null }>();
      if (u) adminUsers[aid] = u;
    } else {
      const u = localDB.getUserById(aid);
      if (u) adminUsers[aid] = { email: u.email, display_name: u.display_name };
    }
  }

  // 批量查找目标用户信息
  const targetIds = [...new Set(logs.map(l => l.target_user_id).filter(Boolean) as string[])];
  const targetUsers: Record<string, { email: string; display_name: string | null }> = {};

  for (const tid of targetIds) {
    if (db) {
      const u = await db.prepare('SELECT email, display_name FROM users WHERE id = ?').bind(tid).first<{ email: string; display_name: string | null }>();
      if (u) targetUsers[tid] = u;
    } else {
      const u = localDB.getUserById(tid);
      if (u) targetUsers[tid] = { email: u.email, display_name: u.display_name };
    }
  }

  const enrichedLogs = logs.map(log => ({
    id: log.id,
    admin: adminUsers[log.admin_id] || { email: 'unknown', display_name: '已删除的管理员' },
    action: log.action,
    target_user: log.target_user_id ? (targetUsers[log.target_user_id] || { email: 'deleted', display_name: '已删除的用户' }) : null,
    details: log.details ? JSON.parse(log.details) : null,
    ip_address: log.ip_address,
    created_at: new Date(log.created_at * 1000).toISOString(),
  }));

  return success(c, {
    logs: enrichedLogs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});
