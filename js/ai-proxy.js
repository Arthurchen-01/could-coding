/* AI API 代理配置 — 通过 Cloudflare Workers 中转，API key 不暴露 */

const AI_PROXY = {
  // ⚠️ 部署后改成你的 Worker URL
  url: 'https://ap-ai-proxy.your-subdomain.workers.dev',

  // 当前使用的 provider
  provider: 'gemini', // 'openai' | 'gemini' | 'anthropic'

  // 模型配置（前端只指定模型名，key 在 Worker 端）
  models: {
    openai: 'gpt-4o',
    gemini: 'gemini-2.0-flash',
    anthropic: 'claude-sonnet-4-20250514',
  },
};

/**
 * 通过代理发送 AI 请求
 * @param {Array} messages - [{role: 'user'|'system', content: '...'}]
 * @param {string} [imageBase64] - 可选，base64 图片
 * @returns {Promise<string>} AI 回复文本
 */
async function callAI(messages, imageBase64 = null) {
  const { url, provider, models } = AI_PROXY;

  if (!url || url.includes('your-subdomain')) {
    throw new Error('⚠️ 请先配置 AI 代理地址：编辑 js/ai-proxy.js 中的 AI_PROXY.url');
  }

  const body = {
    messages,
    model: models[provider],
    max_tokens: 2048,
    temperature: 0.7,
  };

  if (imageBase64) {
    body.image = imageBase64;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Provider': provider,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API 请求失败: ${res.status}`);
  }

  const data = await res.json();
  return data.content || '';
}

/**
 * 便捷方法：单条消息对话
 */
async function askAI(question, systemPrompt = '') {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: question });
  return callAI(messages);
}

/**
 * 便捷方法：带图片分析
 */
async function askAIWithImage(question, imageBase64, systemPrompt = '') {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: question });
  return callAI(messages, imageBase64);
}

// 导出
window.AI_PROXY = AI_PROXY;
window.callAI = callAI;
window.askAI = askAI;
window.askAIWithImage = askAIWithImage;
