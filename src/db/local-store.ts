/**
 * 本地开发用内存数据库
 *
 * 当 D1 不可用时（本地开发、未配置 Cloudflare），
 * 使用内存 Map 模拟数据库操作。
 *
 * 生产环境（c.env.DB 已绑定）会自动走 D1。
 */

interface User {
  id: string;
  email: string;
  password_hash: string | null;
  provider: string;
  role: string;
  google_id: string | null;
  github_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
}

interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_user_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: number;
}

interface Session {
  id: string;
  user_id: string;
  token_jti: string;
  user_agent: string | null;
  ip_address: string | null;
  expires_at: number;
  created_at: number;
}

// 全局内存存储（仅开发环境）
const users = new Map<string, User>();
const sessions = new Map<string, Session>();
const auditLogs: AuditLogEntry[] = [];

export const localDB = {
  // ── 用户操作 ──

  /** 查询单个用户 by email */
  getUserByEmail(email: string): User | undefined {
    for (const user of users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  },

  /** 查询用户 by ID */
  getUserById(id: string): User | undefined {
    return users.get(id);
  },

  /** 创建用户 */
  createUser(user: User): void {
    users.set(user.id, user);
  },

  // ── Session 操作 ──

  /** 创建 Session */
  createSession(session: Session): void {
    sessions.set(session.id, session);
  },

  /** 获取用户的所有有效 Session */
  getSessionsByUserId(userId: string): Session[] {
    const now = Math.floor(Date.now() / 1000);
    const result: Session[] = [];
    for (const s of sessions.values()) {
      if (s.user_id === userId && s.expires_at > now) {
        result.push(s);
      }
    }
    return result;
  },

  // ── Admin 用户管理 ──

  /** 分页获取所有用户（支持搜索） */
  getAllUsers(opts: { search?: string; page?: number; limit?: number }): { users: User[]; total: number } {
    const { search, page = 1, limit = 20 } = opts;
    let list = Array.from(users.values());

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.email.toLowerCase().includes(q) ||
        (u.display_name && u.display_name.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => b.created_at - a.created_at); // 最新优先

    const total = list.length;
    const start = (page - 1) * limit;
    const paged = list.slice(start, start + limit);

    return { users: paged, total };
  },

  /** 计数用户 */
  countUsers(search?: string): number {
    if (!search) return users.size;
    const q = search.toLowerCase();
    let count = 0;
    for (const u of users.values()) {
      if (u.email.toLowerCase().includes(q) ||
          (u.display_name && u.display_name.toLowerCase().includes(q))) {
        count++;
      }
    }
    return count;
  },

  /** 更新用户字段 */
  updateUser(id: string, fields: Partial<Pick<User, 'email' | 'display_name' | 'role' | 'password_hash' | 'updated_at'>>): User | null {
    const user = users.get(id);
    if (!user) return null;
    if (fields.email !== undefined) user.email = fields.email;
    if (fields.display_name !== undefined) user.display_name = fields.display_name;
    if (fields.role !== undefined) user.role = fields.role;
    if (fields.password_hash !== undefined) user.password_hash = fields.password_hash;
    if (fields.updated_at !== undefined) user.updated_at = fields.updated_at;
    return user;
  },

  /** 删除用户 */
  deleteUser(id: string): boolean {
    return users.delete(id);
  },

  /** 获取角色为 admin 的用户数量 */
  countAdmins(): number {
    let count = 0;
    for (const u of users.values()) {
      if (u.role === 'admin') count++;
    }
    return count;
  },

  /** 获取所有活跃 session 数量 */
  countActiveSessions(): number {
    const now = Math.floor(Date.now() / 1000);
    let count = 0;
    for (const s of sessions.values()) {
      if (s.expires_at > now) count++;
    }
    return count;
  },

  // ── 审计日志 ──

  /** 写入审计日志 */
  createAuditLog(entry: AuditLogEntry): void {
    auditLogs.push(entry);
  },

  /** 分页查询审计日志 */
  getAuditLogs(opts: { page?: number; limit?: number }): { logs: AuditLogEntry[]; total: number } {
    const { page = 1, limit = 50 } = opts;
    const sorted = [...auditLogs].sort((a, b) => b.created_at - a.created_at);
    const total = sorted.length;
    const start = (page - 1) * limit;
    const paged = sorted.slice(start, start + limit);
    return { logs: paged, total };
  },

  // ── 调试工具 ──

  _clear(): void {
    users.clear();
    sessions.clear();
    auditLogs.length = 0;
  },

  _count(): { users: number; sessions: number; auditLogs: number } {
    return { users: users.size, sessions: sessions.size, auditLogs: auditLogs.length };
  },
};
