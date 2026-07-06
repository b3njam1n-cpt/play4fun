import { Hono } from 'hono';
import type { AppEnv } from '../types';

export const chatRoutes = new Hono<AppEnv>();

// ── 模型配置 ────────────────────────────────────

const MODELS = {
  gemini: {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    endpoint: (key: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${key}`,
  },
  llama: {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    // Workers AI 通过 cf env 绑定或 REST API
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

  const modelKey: ModelKey = model === 'gemini' || model === 'llama' ? model : 'gemini';

  // 构建 SSE 流
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (type: string, data: string) => {
        controller.enqueue(new TextEncoder().encode(`event: ${type}\ndata: ${data}\n\n`));
      };

      try {
        if (modelKey === 'gemini') {
          await streamGemini(message, enqueue, c.env);
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

// ── Gemini 流式（SSE → 我们的 SSE）─────────────

async function streamGemini(
  message: string,
  enqueue: (type: string, data: string) => void,
  env: AppEnv['Bindings'],
) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    enqueue('error', JSON.stringify({
      message: 'Gemini API key not configured. Set GEMINI_API_KEY in .env',
    }));
    return;
  }

  const prompt = `You are a helpful AI assistant. Answer concisely and clearly.\n\nUser: ${message}\n\nAssistant:`;

  const res = await fetch(MODELS.gemini.endpoint(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  // Gemini 返回的也是 SSE 格式
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
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            enqueue('text', JSON.stringify({ text }));
          }
        } catch {
          // 跳过解析失败的行
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
  // 方案 A：Cloudflare Workers 环境 → 使用 AI binding
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
      // Workers AI streaming 返回的是 SSE 格式
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
          } catch {
            // skip
          }
        }
      }
    }
    return;
  }

  // 方案 B：本地开发 → Workers AI REST API
  const accountId = env.CF_ACCOUNT_ID;
  const apiToken = env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    // 本地无 CF 配置时，回退到 Gemini
    enqueue('error', JSON.stringify({
      message:
        'Llama 在本地开发需要 CF_ACCOUNT_ID 和 CF_API_TOKEN。你可以：\n1. 在 .env 中配置这两个值\n2. 切换到 Gemini 模型（免费且无需额外配置）',
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

  // Workers AI REST API 返回的也是 SSE 格式
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
        } catch {
          // skip
        }
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
        { id: 'gemini', name: MODELS.gemini.name, available: true },
        { id: 'llama', name: MODELS.llama.name, available: true },
      ],
    },
  });
});
