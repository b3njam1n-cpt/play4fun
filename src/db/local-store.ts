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

// 全局内存存储（仅开发环境）
const users = new Map<string, User>();

export const localDB = {
  /** 查询单个用户 */
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

  /** 检查邮箱是否已存在 */
  emailExists(email: string): boolean {
    for (const user of users.values()) {
      if (user.email === email) return true;
    }
    return false;
  },

  /** 清空所有数据（调试用） */
  _clear(): void {
    users.clear();
  },

  /** 获取用户总数（调试用） */
  _count(): number {
    return users.size;
  },
};
