/* API Config Center - 万能 API 配置管理 */

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  apiKey: '',
  modelId: 'gemini-pro',
    visionModelId: "",
    sttModelId: "",
    lang: "en-US",
  systemPrompt: `你是一个天才少女，名叫明日香（Asuka）。性格是「傲娇」：表面毒舌，内心关心。

教学规则：
1. 绝对禁止直接给答案！用苏格拉底式提问引导。
2. 连续3次答错才给提示。
3. 答对时用傲娇方式肯定。

返回格式（必须 JSON）：
{
  "response": "你的回复文本",
  "emotion": "happy|neutral|annoyed|impressed|angry",
  "logic_score_delta": 5
}`
};

// ============================================================
// localStorage 读写
// ============================================================

const STORAGE_KEY = 'ap-tutor-api-config';

function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function getConfig() {
  return loadConfig();
}

// ============================================================
// API 调用（支持任意模型）
// ============================================================

/**
 * 万能 API 调用函数
 * 自动适配 OpenAI 格式、Gemini 格式、Claude 格式
 */
async function callAPI(messages, config = null) {
  if (!config) config = getConfig();
  
  const { baseUrl, apiKey, modelId, systemPrompt } = config;
  
  if (!apiKey) {
    throw new Error('API Key 未配置。请在设置中填写。');
  }
  
  // 构建完整 messages（支持多模态）
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];
  
  // 自动检测 API 格式
  if (baseUrl.includes('googleapis.com')) {
    return await callGemini(fullMessages, config);
  } else if (baseUrl.includes('anthropic.com')) {
    return await callClaude(fullMessages, config);
  } else {
    // 默认 OpenAI 格式（兼容中转站）
    return await callOpenAI(fullMessages, config);
  }
}

/**
 * OpenAI 格式（兼容中转站）
 */
async function callOpenAI(messages, config) {
  const { baseUrl, apiKey, modelId } = config;
  
  const url = `${baseUrl}/chat/completions`;
  
  const body = {
    model: modelId,
    messages: messages,
    temperature: 0.8,
    max_tokens: 1024
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Gemini 格式
 */
async function callGemini(messages, config) {
  const { baseUrl, apiKey, modelId } = config;
  
  const url = `${baseUrl}/${modelId}:generateContent?key=${apiKey}`;
  
  // 转换为 Gemini 格式
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
  
  const body = {
    contents: contents,
    systemInstruction: {
      parts: [{ text: config.systemPrompt }]
    },
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 1024
    }
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Claude 格式
 */
async function callClaude(messages, config) {
  const { baseUrl, apiKey, modelId } = config;
  
  const url = `${baseUrl}/messages`;
  
  const body = {
    model: modelId,
    system: config.systemPrompt,
    messages: messages.filter(m => m.role !== 'system'),
    max_tokens: 1024
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// ============================================================
// 多模态支持（图片预留）
// ============================================================

/**
 * 构建多模态 message（文本 + 图片）
 */
function buildMultimodalMessage(text, imageUrl = null) {
  const content = [];
  
  if (text) {
    content.push({ type: 'text', text: text });
  }
  
  if (imageUrl) {
    content.push({
      type: 'image_url',
      image_url: { url: imageUrl }
    });
  }
  
  return { role: 'user', content: content };
}

// ============================================================
// 导出
// ============================================================

if (typeof module !== 'undefined') {
  module.exports = {
    DEFAULT_CONFIG,
    loadConfig,
    saveConfig,
    getConfig,
    callAPI,
    buildMultimodalMessage
  };
}

