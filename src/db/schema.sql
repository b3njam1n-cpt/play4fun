-- ============================================================
-- play4fun D1 数据库初始 Schema
-- 执行: wrangler d1 execute play4fun-db --local --file=src/db/schema.sql
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,         -- UUID v4
    email         TEXT UNIQUE NOT NULL,     -- 邮箱地址
    password_hash TEXT,                     -- bcrypt 哈希（OAuth 用户为 NULL）
    provider      TEXT NOT NULL DEFAULT 'email',  -- 'email' | 'google' | 'github'
    google_id     TEXT,                     -- Google 账户 ID（SSO 关联）
    github_id     TEXT,                     -- GitHub 账户 ID（预留）
    display_name  TEXT,                     -- 显示名称
    avatar_url    TEXT,                     -- 头像 URL
    role          TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
    created_at    INTEGER NOT NULL,         -- Unix 时间戳（秒）
    updated_at    INTEGER NOT NULL          -- Unix 时间戳（秒）
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,            -- Session UUID
    user_id    TEXT NOT NULL,               -- 关联 users.id
    token_jti  TEXT NOT NULL,               -- JWT JTI，用于黑名单注销
    user_agent TEXT,                        -- 设备信息
    ip_address TEXT,                        -- 登录 IP
    expires_at INTEGER NOT NULL,            -- 过期时间（Unix 秒）
    created_at INTEGER NOT NULL,            -- 创建时间（Unix 秒）
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 角色索引
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 管理员操作审计日志
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id             TEXT PRIMARY KEY,         -- UUID
    admin_id       TEXT NOT NULL,            -- 操作者 users.id
    action         TEXT NOT NULL,            -- 'create_user' | 'update_user' | 'delete_user' | 'change_role'
    target_user_id TEXT,                     -- 被操作用户（无 FK 约束，删除用户后记录保留）
    details        TEXT,                     -- JSON: {before:{...}, after:{...}}
    ip_address     TEXT,                     -- 操作者 IP
    created_at     INTEGER NOT NULL,         -- Unix 时间戳（秒）
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON admin_audit_log(created_at);
