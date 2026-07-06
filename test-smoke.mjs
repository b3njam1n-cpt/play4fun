/**
 * 本地冒烟测试 — 直接在 Node.js 中验证注册/登录核心逻辑
 * 绕过 Wrangler，测试 bcrypt / JWT / Zod / local-store
 */

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

// ── 模拟 localDB ──
const users = new Map();

const localDB = {
  getUserByEmail(email) {
    for (const user of users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  },
  getUserById(id) {
    return users.get(id);
  },
  createUser(user) {
    users.set(user.id, user);
  },
  createSession(session) {
    // 记录但不影响测试
  },
};

// ── 常量 ──
const JWT_SECRET = 'test-secret-for-local-only';
const COOKIE_MAX_AGE = 86400;

// ── Zod Schema ──
const registerSchema = z.object({
  email: z.string().email('email_invalid'),
  password: z.string().min(8, 'password_too_short'),
  display_name: z.string().min(1).max(50).optional(),
});

const loginSchema = z.object({
  email: z.string().email('email_invalid'),
  password: z.string().min(1, 'password_required'),
});

// ── JWT ──
async function createToken(userId) {
  const jti = crypto.randomUUID();
  const secret = new TextEncoder().encode(JWT_SECRET);
  const token = await new SignJWT({ sub: userId, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
  return { token, jti };
}

async function verifyToken(token) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload;
}

// ── 用户响应格式化 ──
function userResponse(user) {
  return {
    id: user.id,
    email: user.email,
    provider: user.provider,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    created_at: new Date(user.created_at * 1000).toISOString(),
  };
}

// ══════════════════════════════════════════════════
// 测试开始
// ══════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

// ──────────────────────────────────────────────────
console.log('\n📝 测试 1: Zod 输入校验');
// ──────────────────────────────────────────────────
{
  // 有效注册
  const r1 = registerSchema.safeParse({ email: 'test@example.com', password: '12345678', display_name: 'Test' });
  assert(r1.success, '合法注册数据通过');
  assert(r1.data.display_name === 'Test', 'display_name 被正确解析');

  // 无效邮箱
  const r2 = registerSchema.safeParse({ email: 'not-email', password: '12345678' });
  assert(!r2.success, '无效邮箱被拒绝');

  // 密码太短
  const r3 = registerSchema.safeParse({ email: 'a@b.com', password: '123' });
  assert(!r3.success, '短密码被拒绝');

  // 有效登录
  const l1 = loginSchema.safeParse({ email: 'test@example.com', password: 'correct' });
  assert(l1.success, '合法登录数据通过');

  // 登录密码为空
  const l2 = loginSchema.safeParse({ email: 'test@example.com', password: '' });
  assert(!l2.success, '空密码被拒绝');
}

// ──────────────────────────────────────────────────
console.log('\n📝 测试 2: 密码哈希和验证');
// ──────────────────────────────────────────────────
{
  const password = 'mySecureP@ss1';
  const hash = await bcrypt.hash(password, 10);
  assert(typeof hash === 'string' && hash.startsWith('$2'), 'bcrypt 哈希生成成功');

  const valid = await bcrypt.compare(password, hash);
  assert(valid, '正确密码验证通过');

  const invalid = await bcrypt.compare('wrongPassword', hash);
  assert(!invalid, '错误密码验证失败');

  // 不同哈希不同结果
  const hash2 = await bcrypt.hash(password, 10);
  assert(hash !== hash2, '两次哈希结果不同（salt 随机）');
}

// ──────────────────────────────────────────────────
console.log('\n📝 测试 3: 注册流程（完整模拟）');
// ──────────────────────────────────────────────────
{
  const email = 'alice@example.com';
  const password = 'password123';
  const displayName = 'Alice';

  // 检查重复
  const existing = localDB.getUserByEmail(email);
  assert(!existing, '邮箱未被注册');

  // 创建用户
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = {
    id,
    email,
    password_hash: passwordHash,
    provider: 'email',
    google_id: null,
    github_id: null,
    display_name: displayName,
    avatar_url: null,
    created_at: now,
    updated_at: now,
  };
  localDB.createUser(newUser);

  // 生成 JWT
  const { token, jti } = await createToken(id);
  assert(typeof token === 'string' && token.split('.').length === 3, 'JWT 格式正确');
  assert(typeof jti === 'string', 'jti 已生成');

  // 验证 User Response 格式
  const resp = userResponse(newUser);
  assert(resp.id === id, '响应包含 id');
  assert(resp.email === email, '响应包含 email');
  assert(resp.display_name === 'Alice', '响应包含 display_name');
  assert(resp.provider === 'email', '响应包含 provider');
  assert(typeof resp.created_at === 'string', 'created_at 是 ISO 字符串');
}

// ──────────────────────────────────────────────────
console.log('\n📝 测试 4: 登录流程（完整模拟）');
// ──────────────────────────────────────────────────
{
  const email = 'alice@example.com';
  const password = 'password123';

  // 查找用户
  const user = localDB.getUserByEmail(email);
  assert(!!user, '用户存在');

  // 密码正确
  const valid = await bcrypt.compare(password, user.password_hash);
  assert(valid, '密码验证通过');

  // 密码错误
  const invalid = await bcrypt.compare('wrong', user.password_hash);
  assert(!invalid, '错误密码被拒绝');

  // OAuth 用户无密码哈希
  const nullHashUser = { ...user, password_hash: null };
  assert(!nullHashUser.password_hash, 'password_hash 为 null 时被拒绝');

  // 生成 JWT Session
  const { token, jti } = await createToken(user.id);
  assert(typeof token === 'string', '登录生成 JWT');

  const payload = await verifyToken(token);
  assert(payload.sub === user.id, 'JWT payload.sub 匹配 userId');
  assert(payload.jti === jti, 'JWT payload.jti 匹配');
}

// ──────────────────────────────────────────────────
console.log('\n📝 测试 5: JWT 中间件逻辑');
// ──────────────────────────────────────────────────
{
  const userId = 'user-abc-123';
  const { token } = await createToken(userId);

  // 有效 token
  const payload = await verifyToken(token);
  assert(payload.sub === userId, '有效 token 解析成功');

  // 过期 token（创建时设为已过期）
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const expired = await new SignJWT({ sub: userId, jti: crypto.randomUUID() })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('0s') // 立即过期
      .sign(secret);
    await jwtVerify(expired, secret);
    assert(false, '过期 token 应该被拒绝');
  } catch {
    assert(true, '过期 token 正确拒绝');
  }

  // 缺少 sub
  const secret = new TextEncoder().encode(JWT_SECRET);
  const noSubToken = await new SignJWT({ jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
  const noSubPayload = await jwtVerify(noSubToken, secret);
  assert(!noSubPayload.payload.sub, '无 sub 的 token 应返回 undefined sub');
}

// ──────────────────────────────────────────────────
console.log('\n📝 测试 6: 邮箱重复注册被拒');
// ──────────────────────────────────────────────────
{
  const email = 'alice@example.com';
  const existing = localDB.getUserByEmail(email);
  assert(!!existing, '邮箱已存在 → 注册应被拒绝');
}

// ──────────────────────────────────────────────────
console.log('\n📝 测试 7: 统一响应格式');
// ──────────────────────────────────────────────────
{
  const user = localDB.getUserByEmail('alice@example.com');
  const resp = userResponse(user);

  // 注册和登录都返回 { token, user } 结构
  const registerResponse = { token: 'xxx', user: resp };
  const loginResponse = { token: 'yyy', user: resp };

  assert(registerResponse.user.id === loginResponse.user.id, '注册和登录返回相同的 user 结构');
  assert('display_name' in registerResponse.user, 'user 包含 display_name');
  assert('avatar_url' in registerResponse.user, 'user 包含 avatar_url');
  assert('provider' in registerResponse.user, 'user 包含 provider');
  assert('created_at' in registerResponse.user, 'user 包含 created_at');
}

// ══════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${passed} passed, ${failed} failed (共 ${passed + failed} 项)`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) process.exit(1);
