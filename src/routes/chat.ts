import { Hono } from 'hono';
import type { AppEnv } from '../types';

export const chatRoutes = new Hono<AppEnv>();

// ── 模型配置 ────────────────────────────────────

const MODELS = {
  deepseek: {
    id: 'deepseek-chat',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
  },
  llama: {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    endpoint: (accountId: string) =>
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
  },
} as const;

type ModelKey = keyof typeof MODELS;

// ── POST /api/chat（SSE 流式）───────────────────

chatRoutes.post('/chat', async (c) => {
  let body: { message?: string; model?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'invalid_json' }, 400);
  }

  const { message, model } = body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return c.json({ success: false, message: 'message_required' }, 400);
  }

  const modelKey = (model === 'deepseek' || model === 'llama') ? model : 'deepseek' as ModelKey;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (type: string, data: string) => {
        controller.enqueue(new TextEncoder().encode(`event: ${type}\ndata: ${data}\n\n`));
      };

      try {
        if (modelKey === 'deepseek') {
          await streamDeepSeek(message, enqueue, c.env);
        } else {
          await streamLlama(message, enqueue, c.env);
        }
        enqueue('done', '{}');
      } catch (e: any) {
        console.error(`[chat:${modelKey}] error:`, e);
        enqueue('error', JSON.stringify({ message: e.message || 'ai_error' }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Model': modelKey,
    },
  });
});

// ── DeepSeek 流式（OpenAI 兼容 SSE）─────────────

async function streamDeepSeek(
  message: string,
  enqueue: (type: string, data: string) => void,
  env: AppEnv['Bindings'],
) {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    enqueue('error', JSON.stringify({
      message: 'DeepSeek API key 未配置。\n1. 去 https://platform.deepseek.com/ 注册（国内直连）\n2. 在 .env 中设置 DEEPSEEK_API_KEY=sk-xxx',
    }));
    return;
  }

  const res = await fetch(MODELS.deepseek.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELS.deepseek.id,
      messages: [{ role: 'user', content: message }],
      stream: true,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            enqueue('text', JSON.stringify({ text: content }));
          }
        } catch {
          // skip malformed SSE chunks
        }
      }
    }
  }
}

// ── Llama 流式（Workers AI → SSE）───────────────

async function streamLlama(
  message: string,
  enqueue: (type: string, data: string) => void,
  env: AppEnv['Bindings'],
) {
  // 方案 A：Cloudflare Workers 环境 → AI binding
  if (env.AI && typeof env.AI.run === 'function') {
    const stream = (await env.AI.run(MODELS.llama.id, {
      messages: [{ role: 'user', content: message }],
      stream: true,
    })) as ReadableStream;

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.response || parsed.choices?.[0]?.delta?.content;
            if (content) {
              enqueue('text', JSON.stringify({ text: content }));
            }
          } catch { /* skip */ }
        }
      }
    }
    return;
  }

  // 方案 B：本地开发 → Workers AI REST API
  const accountId = env.CF_ACCOUNT_ID;
  const apiToken = env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    enqueue('error', JSON.stringify({
      message:
        'Llama 在本地开发需要 CF_ACCOUNT_ID 和 CF_API_TOKEN。\n1. 去 https://dash.cloudflare.com（国内直连）创建 API Token\n2. 在 .env 中配置这两个值\n3. 也可以切换到 DeepSeek 模型',
    }));
    return;
  }

  const res = await fetch(MODELS.llama.endpoint(accountId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: message }],
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Workers AI error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.response || parsed.choices?.[0]?.delta?.content;
          if (content) {
            enqueue('text', JSON.stringify({ text: content }));
          }
        } catch { /* skip */ }
      }
    }
  }
}

// ── GET /api/models ─────────────────────────────

chatRoutes.get('/models', (c) => {
  return c.json({
    success: true,
    data: {
      models: [
        { id: 'deepseek', name: MODELS.deepseek.name, available: true },
        { id: 'llama', name: MODELS.llama.name, available: true },
      ],
    },
  });
});
