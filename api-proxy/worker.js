// Cloudflare Workers — AI API 代理
// 部署后，前端只调用这个 Worker URL，API key 永远不暴露
//
// 设置方法：
// 1. wrangler secret put OPENAI_API_KEY
// 2. wrangler secret put GEMINI_API_KEY
// 3. wrangler secret put ANTHROPIC_API_KEY
// 4. wrangler deploy

export default {
  async fetch(request, env) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Provider',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();
      const provider = request.headers.get('X-Provider') || 'openai';

      let response;
      switch (provider) {
        case 'openai':
          response = await proxyOpenAI(body, env);
          break;
        case 'gemini':
          response = await proxyGemini(body, env);
          break;
        case 'anthropic':
          response = await proxyAnthropic(body, env);
          break;
        default:
          return new Response(JSON.stringify({ error: 'Unknown provider' }), {
            status: 400,
            headers: corsHeaders(),
          });
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: corsHeaders(),
      });
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
}

// ============================================================
// OpenAI 兼容代理
// ============================================================
async function proxyOpenAI(body, env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const baseUrl = body.baseUrl || 'https://api.openai.com/v1';
  const model = body.model || 'gpt-4o';

  const payload = {
    model,
    messages: body.messages,
    max_tokens: body.max_tokens || 2048,
    temperature: body.temperature ?? 0.7,
  };

  // 如果有图片（base64），用 vision 格式
  if (body.image) {
    payload.messages = body.messages.map(msg => {
      if (msg.role === 'user' && msg === body.messages[body.messages.length - 1]) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: msg.content },
            { type: 'image_url', image_url: { url: body.image } },
          ],
        };
      }
      return msg;
    });
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'OpenAI API error');

  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model,
    usage: data.usage,
  };
}

// ============================================================
// Gemini 代理
// ============================================================
async function proxyGemini(body, env) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const model = body.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // 转换消息格式
  const contents = body.messages
    .filter(m => m.role !== 'system')
    .map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

  const payload = {
    contents,
    generationConfig: {
      maxOutputTokens: body.max_tokens || 2048,
      temperature: body.temperature ?? 0.7,
    },
  };

  // 如果有系统提示，加 systemInstruction
  const systemMsg = body.messages.find(m => m.role === 'system');
  if (systemMsg) {
    payload.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  // 如果有图片
  if (body.image) {
    const lastContent = contents[contents.length - 1];
    const base64Data = body.image.replace(/^data:image\/\w+;base64,/, '');
    lastContent.parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { content: text, model };
}

// ============================================================
// Anthropic (Claude) 代理
// ============================================================
async function proxyAnthropic(body, env) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const model = body.model || 'claude-sonnet-4-20250514';

  const systemMsg = body.messages.find(m => m.role === 'system');
  const messages = body.messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  const payload = {
    model,
    max_tokens: body.max_tokens || 2048,
    messages,
    ...(systemMsg ? { system: systemMsg.content } : {}),
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const text = data.content?.[0]?.text || '';
  return { content: text, model };
}
