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
  google_id: string | null;
  github_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
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

  // ── 调试工具 ──

  _clear(): void {
    users.clear();
    sessions.clear();
  },

  _count(): { users: number; sessions: number } {
    return { users: users.size, sessions: sessions.size };
  },
};
