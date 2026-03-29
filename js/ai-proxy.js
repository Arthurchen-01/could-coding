/* AI API 代理 — 支持 Cloudflare Worker 代理 或 直连 OpenAI-compatible API */

const AI_PROXY = {
  url: '',
  provider: 'openai',
  models: {
    openai: 'gpt-4o',
    gemini: 'gemini-2.0-flash',
    anthropic: 'claude-sonnet-4-20250514',
  },
};

/**
 * 从 localStorage 加载用户配置
 */
function loadUserConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('api-config') || '{}');
    if (cfg.baseUrl) {
      AI_PROXY.url = cfg.baseUrl;
      AI_PROXY.models.openai = cfg.modelId || 'gpt-4o';
    }
    return cfg;
  } catch { return {}; }
}

/**
 * 通过代理或直连发送 AI 请求
 */
async function callAI(messages, imageBase64 = null) {
  const cfg = loadUserConfig();
  let baseUrl = cfg.baseUrl || AI_PROXY.url;
  let apiKey = cfg.apiKey || '';
  let modelId = cfg.modelId || 'gpt-4o';

  if (!baseUrl) {
    throw new Error('⚠️ 请先配置 API：打开设置填写 Base URL 和 API Key');
  }

  // 确保 baseUrl 末尾有 /chat/completions
  if (!baseUrl.includes('/chat/completions')) {
    baseUrl = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  }

  const body = {
    model: modelId,
    messages: messages,
    max_tokens: 2048,
    temperature: 0.7,
  };

  // 如果有图片，转换为 OpenAI vision 格式
  if (imageBase64) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'user') {
      lastMsg.content = [
        { type: 'text', text: lastMsg.content },
        {
          type: 'image_url',
          image_url: {
            url: imageBase64.startsWith('data:') ? imageBase64 : 'data:image/png;base64,' + imageBase64,
          },
        },
      ];
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = 'Bearer ' + apiKey;
  }

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 请求失败 (${res.status}): ${res.statusText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * 便捷方法：单条消息对话
 */
async function askAI(question, systemPrompt = '') {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: question });
  return callAI(messages);
}

/**
 * 便捷方法：带图片分析
 */
async function askAIWithImage(question, imageBase64, systemPrompt = '') {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: question });
  return callAI(messages, imageBase64);
}

// 导出
window.AI_PROXY = AI_PROXY;
window.callAI = callAI;
window.askAI = askAI;
window.askAIWithImage = askAIWithImage;
