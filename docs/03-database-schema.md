# 数据库表结构 (D1 / SQLite)

## 表清单

| 表名 | 用途 |
|------|------|
| users | 用户账户（支持邮箱登录 + OAuth） |
| sessions | 活跃会话（JWT 黑名单 / 多设备管理） |

---

## users

```sql
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,       -- UUID v4
    email         TEXT UNIQUE NOT NULL,   -- 邮箱地址
    password_hash TEXT,                   -- bcrypt 哈希（OAuth 用户为 NULL）
    provider      TEXT NOT NULL DEFAULT 'email',  -- 'email' | 'google' | 'github'
    google_id     TEXT,                   -- Google 账户 ID（预留）
    github_id     TEXT,                   -- GitHub 账户 ID（预留）
    display_name  TEXT,                   -- 显示名称
    avatar_url    TEXT,                   -- 头像 URL
    created_at    INTEGER NOT NULL,       -- Unix 时间戳（秒）
    updated_at    INTEGER NOT NULL        -- Unix 时间戳（秒）
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
```

### 字段说明

| 字段 | 类型 | 空 | 说明 |
|------|------|-----|------|
| id | TEXT | N | UUID v4，主键 |
| email | TEXT | N | 唯一邮箱 |
| password_hash | TEXT | Y | NULL = OAuth 用户，无密码 |
| provider | TEXT | N | 认证来源：email/google/github |
| google_id | TEXT | Y | Google 账户 ID，用于 SSO 关联 |
| github_id | TEXT | Y | GitHub 账户 ID，预留 |
| display_name | TEXT | Y | 显示名称（OAuth 获取） |
| avatar_url | TEXT | Y | 头像 URL |
| created_at | INTEGER | N | 账户创建时间 |
| updated_at | INTEGER | N | 最后更新时间 |

### 设计原则

- **同一邮箱多 provider**：email 唯一，用户可以用同一个邮箱通过 Google 和密码分别登录 → 匹配 email 后自动关联
- **password_hash 可空**：纯 OAuth 用户不需要密码
- **扩展性**：新增 provider 只需加新列 + 新索引

---

## sessions

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,         -- Session ID (UUID)
    user_id    TEXT NOT NULL,            -- 关联 users.id
    token_jti  TEXT NOT NULL,            -- JWT jti (JWT ID)，用于黑名单
    user_agent TEXT,                     -- 设备信息
    ip_address TEXT,                     -- 登录 IP
    expires_at INTEGER NOT NULL,        -- 过期时间
    created_at INTEGER NOT NULL,        -- 创建时间
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
```

### 字段说明

| 字段 | 说明 |
|------|------|
| token_jti | JWT ID，登出时将 jti 加入黑名单即可实现 SLO |
| user_agent | 记录设备，实现「查看活跃设备」 |
| ip_address | 记录 IP，安全审计 |
| expires_at | 过期后定期清理 |

---

## 迁移计划

### Oracle Cloud 迁移
- D1 (SQLite) → PostgreSQL
- `INTEGER` 时间戳 → `TIMESTAMP WITH TIME ZONE`
- `TEXT` UUID → `UUID` 类型
- 除类型调整外，表结构保持一致
