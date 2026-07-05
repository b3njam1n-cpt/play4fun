# ============================================================
# play4fun — 多阶段构建
# 用于 Oracle Cloud / 任意 Linux 环境部署
# ============================================================

# ── 阶段 1：构建前端（未来 React/Vue 时使用）─────────
FROM node:24-alpine AS frontend-builder
WORKDIR /app/frontend
# COPY frontend/package.json frontend/package-lock.json ./
# RUN npm ci
# COPY frontend/ ./
# RUN npm run build

# ── 阶段 2：生产运行 ───────────────────────────────
FROM node:24-alpine

WORKDIR /app

# 复制后端依赖
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 复制后端源码
COPY src/ ./src/
COPY tsconfig.json ./

# 复制静态文件（或从前端构建阶段复制）
COPY public/ ./public/
# COPY --from=frontend-builder /app/frontend/dist ./public

# 使用 Node.js 运行 Hono 应用（非 Workers 模式）
# Hono 支持 Node.js 运行时适配器
COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
