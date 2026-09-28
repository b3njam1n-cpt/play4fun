import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { success, error } from '../utils/response';
import { localDB } from '../db/local-store';
import type { AppEnv } from '../types';

export const sitesRoutes = new Hono<AppEnv>();

// ── 输入校验 ────────────────────────────────────

const MAX_HTML_BYTES = 256 * 1024; // 256KB

const uploadSchema = z.object({
  title: z.string().min(1, 'title_required').max(100, 'title_too_long'),
  description: z.string().max(500, 'description_too_long').optional().default(''),
  html: z.string().min(1, 'html_required').refine((v) => new TextEncoder().encode(v).length <= MAX_HTML_BYTES, 'html_too_large'),
});

// ── 路径段净化 ─────────────────────────────────

/**
 * 净化用户显示名/标题为 URL 安全路径段：
 * 保留字母数字和连字符，空格转连字符，小写化。
 * 中文等非 ASCII 字符会被剔除，若结果为空返回 null（由调用方回退）。
 */
function sanitizeSegment(input: string): string | null {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || null;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
}

interface PageRow {
  id: string;
  user_id: string;
  handle: string;
  slug: string;
  title: string;
  description: string;
  html_content: string;
  created_at: number;
}

async function findUserById(id: string, db?: D1Database): Promise<UserRow | null> {
  if (db) {
    return await db.prepare('SELECT id, email, display_name FROM users WHERE id = ?')
      .bind(id).first<UserRow>();
  }
  const u = localDB.getUserById(id);
  return u ? { id: u.id, email: u.email, display_name: u.display_name } : null;
}

async function findPageByHandleSlug(handle: string, slug: string, db?: D1Database): Promise<PageRow | null> {
  if (db) {
    return await db.prepare(
      'SELECT id, user_id, handle, slug, title, description, html_content, created_at FROM user_pages WHERE handle = ? AND slug = ?'
    ).bind(handle, slug).first<PageRow>();
  }
  const p = localDB.getPageByHandleSlug(handle, slug);
  return p ? { ...p } : null;
}

async function getExistingSlugs(handle: string, db?: D1Database): Promise<Set<string>> {
  if (db) {
    const rows = await db.prepare('SELECT slug FROM user_pages WHERE handle = ?')
      .bind(handle).all<{ slug: string }>();
    return new Set((rows.results ?? []).map((r) => r.slug));
  }
  return localDB.getSlugsByHandle(handle);
}

async function handleTakenByOther(handle: string, userId: string, db?: D1Database): Promise<boolean> {
  if (db) {
    const row = await db.prepare(
      'SELECT id FROM user_pages WHERE handle = ? AND user_id != ? LIMIT 1'
    ).bind(handle, userId).first<{ id: string }>();
    return !!row;
  }
  return localDB.handleTakenByOther(handle, userId);
}

/** 生成不冲突的 handle：撞名（其他用户已用）时追加 -2/-3 */
async function resolveHandle(base: string, userId: string, db?: D1Database): Promise<string> {
  let handle = base;
  let n = 2;
  while (await handleTakenByOther(handle, userId, db)) {
    handle = `${base}-${n}`;
    n++;
  }
  return handle;
}

/** 生成同 handle 下不冲突的 slug */
async function resolveSlug(handle: string, base: string, db?: D1Database): Promise<string> {
  const existing = await getExistingSlugs(handle, db);
  let slug = base;
  let n = 2;
  while (existing.has(slug)) {
    slug = `${base}-${n}`;
    n++;
  }
  return slug;
}

function pageResponse(p: PageRow) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    uri: `/s/${p.handle}/${p.slug}`,
    created_at: new Date(p.created_at * 1000).toISOString(),
  };
}

// ── GET /api/sites — 列出本人的页面 ─────────────

sitesRoutes.get('/api/sites', requireAuth, async (c) => {
  const userId = c.get('userId');
  if (!userId) return error(c, 401, 'unauthorized', {});

  let pages: PageRow[];
  if (c.env.DB) {
    const rows = await c.env.DB.prepare(
      'SELECT id, user_id, handle, slug, title, description, html_content, created_at FROM user_pages WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all<PageRow>();
    pages = rows.results ?? [];
  } else {
    pages = localDB.listPagesByUser(userId);
  }

  return success(c, { items: pages.map(pageResponse), total: pages.length });
});

// ── POST /api/sites — 上传页面 ──────────────────

sitesRoutes.post('/api/sites', requireAuth, async (c) => {
  const userId = c.get('userId');
  if (!userId) return error(c, 401, 'unauthorized', {});

  let body: unknown;
  try { body = await c.req.json(); } catch {
    return error(c, 400, 'invalid_json', {});
  }

  const result = uploadSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return error(c, 400, firstIssue.message, { field: firstIssue.path.join('.') });
  }

  const { title, description, html } = result.data;

  // 查询用户，生成 handle（显示名优先，净化失败回退邮箱前缀）
  const user = await findUserById(userId, c.env.DB);
  if (!user) return error(c, 404, 'user_not_found', {});

  const baseHandle = sanitizeSegment(user.display_name || '') || sanitizeSegment(user.email.split('@')[0]) || 'user';
  const handle = await resolveHandle(baseHandle, userId, c.env.DB);
  const slugBase = sanitizeSegment(title) || 'page';
  const slug = await resolveSlug(handle, slugBase, c.env.DB);

  // 写入 D1（生产）或本地内存（开发）
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  if (c.env.DB) {
    try {
      await c.env.DB.prepare(`
        INSERT INTO user_pages (id, user_id, handle, slug, title, description, html_content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, userId, handle, slug, title, description, html, now, now).run();
    } catch (e) {
      console.error('D1 insert user_pages failed:', e);
      return error(c, 500, 'db_error', {});
    }
  }
  localDB.createPage({
    id, user_id: userId, handle, slug,
    title, description, html_content: html,
    created_at: now, updated_at: now,
  });

  return success(c, pageResponse({
    id, user_id: userId, handle, slug,
    title, description, html_content: html,
    created_at: now,
  }), '上传成功', 201);
});

// ── DELETE /api/sites/:id — 删除自己的页面 ──────

sitesRoutes.delete('/api/sites/:id', requireAuth, async (c) => {
  const userId = c.get('userId');
  if (!userId) return error(c, 401, 'unauthorized', {});

  const id = c.req.param('id');
  if (c.env.DB) {
    const res = await c.env.DB.prepare(
      'DELETE FROM user_pages WHERE id = ? AND user_id = ?'
    ).bind(id, userId).run();
    if (!res.meta.changes) return error(c, 404, 'page_not_found', {});
  } else {
    const page = localDB.getPageById(id);
    if (!page || page.user_id !== userId) return error(c, 404, 'page_not_found', {});
    localDB.deletePage(id);
  }
  return success(c, null, '已删除');
});

// ── GET /s/:handle/:slug — 公开访问上传的页面 ──

sitesRoutes.get('/s/:handle/:slug', async (c) => {
  const handle = c.req.param('handle');
  const slug = c.req.param('slug');

  const page = await findPageByHandleSlug(handle, slug, c.env.DB);
  if (!page) {
    return error(c, 404, 'page_not_found', {});
  }

  // CSP sandbox：脚本运行在 opaque origin，无法读取本站 Cookie 或调用同源 API
  c.header('Content-Type', 'text/html; charset=utf-8');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Cache-Control', 'no-store');
  c.header(
    'Content-Security-Policy',
    "sandbox allow-scripts allow-forms allow-popups; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; img-src * data: blob:; media-src * data: blob:"
  );
  return c.body(page.html_content);
});
