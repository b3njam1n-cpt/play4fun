# 认证 API 接口文档

## 基础信息

- Base URL: `https://<worker-name>.<your-subdomain>.workers.dev`
- Content-Type: `application/json`
- 认证方式: Bearer Token (JWT via httpOnly Cookie 或 Authorization header)

---

## POST /auth/register

注册新用户。

### Request Body

```json
{
  "email": "user@example.com",
  "password": "min8chars"
}
```

### 字段校验

| 字段 | 规则 |
|------|------|
| email | 必填，合法邮箱格式 |
| password | 必填，最少 8 位 |

### Response (201 Created)

```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2025-07-05T00:00:00Z"
  }
}
```

### Error Responses

| 状态码 | 错误信息 | 原因 |
|--------|---------|------|
| 400 | `email_invalid` | 邮箱格式不合法 |
| 400 | `password_too_short` | 密码不足 8 位 |
| 409 | `email_exists` | 邮箱已被注册 |

---

## POST /auth/login

登录并获取 JWT Token。

### Request Body

```json
{
  "email": "user@example.com",
  "password": "min8chars"
}
```

### Response (200 OK)

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "provider": "email"
    }
  }
}
```

> Token 同时通过 `Set-Cookie` 头设置为 httpOnly Cookie。

### Error Responses

| 状态码 | 错误信息 | 原因 |
|--------|---------|------|
| 401 | `invalid_credentials` | 邮箱或密码错误 |

---

## POST /auth/logout

登出，清除 Session。

### Response (200 OK)

```json
{
  "success": true,
  "message": "已登出"
}
```

> 服务端清除 Cookie。

---

## GET /auth/me

获取当前登录用户信息。

### Headers

```
Cookie: token=eyJhbGciOi...
```
或
```
Authorization: Bearer eyJhbGciOi...
```

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "provider": "email",
    "avatar_url": null,
    "created_at": "2025-07-05T00:00:00Z"
  }
}
```

### Error Responses

| 状态码 | 错误信息 | 原因 |
|--------|---------|------|
| 401 | `unauthorized` | Token 缺失或已过期 |

---

## 未来扩展：Google OAuth

### GET /auth/google

发起 Google OAuth 流程，重定向到 Google 授权页。

### GET /auth/google/callback

Google 回调，完成授权、创建/关联账户、签发 JWT。

### POST /auth/slo

Single Log-Out：同时登出所有已关联的 Session 和设备。

---

## 统一响应格式

所有 API 响应遵循：

```json
{
  "success": true | false,
  "message": "人类可读的信息",
  "data": {} | null,
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```
