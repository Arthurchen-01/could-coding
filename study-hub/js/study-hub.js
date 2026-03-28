/* Study Hub - Multimodal Learning Cabin Logic */

// ============================================================
// State
// ============================================================

let imageBase64 = null;      // 当前材料的 Base64
let imageContextLoaded = false; // 是否已静默加载上下文
let conversationHistory = [];   // 对话历史

// ============================================================
// Init
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  bindUpload();
  bindActions();
  bindChat();
});

// ============================================================
// 1. Upload & Base64 转换
// ============================================================

function bindUpload() {
  const area = document.getElementById('upload-area');
  const input = document.getElementById('file-input');
  
  area.addEventListener('click', () => input.click());
  
  // 拖拽
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });
  
  // 文件选择
  input.addEventListener('change', (e) => {
    if (e.target.files[0]) processFile(e.target.files[0]);
  });
  
  // 清除
  document.getElementById('clear-material').addEventListener('click', clearMaterial);
  
  // 缩放
  let zoomLevel = 1;
  document.getElementById('zoom-in').addEventListener('click', () => {
    zoomLevel = Math.min(zoomLevel + 0.2, 3);
    document.getElementById('preview-image').style.transform = `scale(${zoomLevel})`;
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
    document.getElementById('preview-image').style.transform = `scale(${zoomLevel})`;
  });
}

async function processFile(file) {
  if (file.type.startsWith('image/')) {
    // 图片 → Base64
    const reader = new FileReader();
    reader.onload = (e) => {
      imageBase64 = e.target.result; // data:image/png;base64,...
      showPreview(imageBase64);
      enableChat();
      updateStatus('已加载', 'loaded');
    };
    reader.readAsDataURL(file);
  } else if (file.type === 'application/pdf') {
    // PDF → 显示提示（后续处理）
    addMessage('system', '📄 PDF 文件已接收。请先截图其中一页作为图片上传，以便 AI 识别。');
  }
}

function showPreview(src) {
  document.getElementById('upload-area').style.display = 'none';
  document.getElementById('preview-area').style.display = 'flex';
  document.getElementById('preview-image').src = src;
  imageContextLoaded = false;
  document.getElementById('context-indicator').style.display = 'none';
}

function clearMaterial() {
  imageBase64 = null;
  imageContextLoaded = false;
  document.getElementById('upload-area').style.display = 'flex';
  document.getElementById('preview-area').style.display = 'none';
  document.getElementById('context-indicator').style.display = 'none';
  disableChat();
  updateStatus('未加载', '');
}

function enableChat() {
  document.getElementById('chat-input').disabled = false;
  document.getElementById('send-btn').disabled = false;
  document.getElementById('silent-read-btn').disabled = false;
  document.getElementById('test-me-btn').disabled = false;
}

function disableChat() {
  document.getElementById('chat-input').disabled = true;
  document.getElementById('send-btn').disabled = true;
  document.getElementById('silent-read-btn').disabled = true;
  document.getElementById('test-me-btn').disabled = true;
}

function updateStatus(text, className) {
  const el = document.getElementById('material-status');
  el.textContent = text;
  el.className = 'material-status ' + (className || '');
}

// ============================================================
// 2. Action Buttons (三流 API 交互)
// ============================================================

function bindActions() {
  // 流 A：静默读图
  document.getElementById('silent-read-btn').addEventListener('click', silentRead);
  
  // 流 C：苏格拉底突击
  document.getElementById('test-me-btn').addEventListener('click', socraticTest);
}

/**
 * 流 A：静默读图
 * 发送图片给 AI，要求只阅读不回复
 */
async function silentRead() {
  if (!imageBase64) return;
  
  const btn = document.getElementById('silent-read-btn');
  btn.disabled = true;
  btn.textContent = '👀 阅读中...';
  
  const config = loadConfig();
  
  // 构建多模态消息
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: '你现在只需要阅读并记住这张图里的所有知识点、公式和文字。回复"已阅，已记住图中内容。"即可，不要多说话。' },
        { type: 'image_url', image_url: { url: imageBase64 } }
      ]
    }
  ];
  
  try {
    const response = await callVisionAPI(messages, config);
    
    // 标记上下文已加载
    imageContextLoaded = true;
    document.getElementById('context-indicator').style.display = 'flex';
    updateStatus('AI 已阅读', 'ai-read');
    
    addMessage('system', '✅ 明日香已阅读并记住当前材料。你现在可以提问了！');
    
  } catch (error) {
    addMessage('system', `❌ 阅读失败：${error.message}`);
  }
  
  btn.disabled = false;
  btn.textContent = '👀 让导师看这页';
}

/**
 * 流 C：苏格拉底突击
 * 根据图片内容出题考用户
 */
async function socraticTest() {
  if (!imageBase64) return;
  
  const btn = document.getElementById('test-me-btn');
  btn.disabled = true;
  btn.textContent = '🎯 出题中...';
  
  const config = loadConfig();
  
  const messages = [
    {
      role: 'user',
      content: [
        { 
          type: 'text', 
          text: '根据这张图里的知识点，向我提出一个极其刁钻的底层逻辑问题。绝对禁止直接给答案！用苏格拉底式提问，一步步反问我，引导我自己发现答案。\n\n返回格式：{"response":"你的问题","emotion":"neutral","logic_score_delta":0}' 
        },
        { type: 'image_url', image_url: { url: imageBase64 } }
      ]
    }
  ];
  
  try {
    const rawText = await callVisionAPI(messages, config);
    const parsed = parseResponse(rawText);
    
    addMessage('tutor', parsed.response);
    if (parsed.emotion) updateEmotion(parsed.emotion);
    
  } catch (error) {
    addMessage('tutor', `（明日香皱眉）出题失败：${error.message}`);
  }
  
  btn.disabled = false;
  btn.textContent = '🎯 考考我';
}

// ============================================================
// 3. Chat (流 B：带图追问)
// ============================================================

function bindChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  
  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });
}

/**
 * 流 B：带图追问
 * 用户提问时，自动带上图片上下文
 */
async function handleSend() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  
  addMessage('user', text);
  input.value = '';
  
  conversationHistory.push({ role: 'user', content: text });
  
  const thinking = addMessage('tutor', '（明日香正在思考...）');
  
  const config = loadConfig();
  
  // 构建消息（带图片上下文）
  const messages = [];
  
  // 系统指令
  messages.push({
    role: 'system',
    content: config.systemPrompt || '你是一个傲娇的天才少女导师。用苏格拉底式提问引导学习，禁止直接给答案。返回JSON格式。'
  });
  
  // 如果有图片，加入图片上下文
  if (imageBase64 && imageContextLoaded) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: '这是我的学习材料：' },
        { type: 'image_url', image_url: { url: imageBase64 } }
      ]
    });
  }
  
  // 对话历史
  conversationHistory.slice(-4).forEach(h => {
    messages.push(h);
  });
  
  // 当前问题
  messages.push({
    role: 'user',
    content: text
  });
  
  try {
    let rawText;
    if (imageBase64 && !imageContextLoaded) {
      // 首次提问且未静默加载 → 直接带图
      rawText = await callVisionAPI(messages, config);
    } else {
      // 已静默加载 → 纯文本追问
      rawText = await callAPI(messages, config);
    }
    
    const parsed = parseResponse(rawText);
    if (thinking) thinking.remove();
    
    addMessage('tutor', parsed.response);
    if (parsed.emotion) updateEmotion(parsed.emotion);
    
    conversationHistory.push({ role: 'assistant', content: parsed.response });
    
  } catch (error) {
    if (thinking) thinking.remove();
    addMessage('tutor', `（明日香叹气）出错了：${error.message}`);
  }
}

// ============================================================
// 4. Vision API 调用（多模态核心）
// ============================================================

/**
 * 调用多模态 Vision API
 * 支持 image_url + text 混合消息
 */
async function callVisionAPI(messages, config) {
  if (!config.apiKey) {
    throw new Error('API Key 未配置');
  }
  
  const { baseUrl, apiKey, modelId } = config;
  
  if (baseUrl.includes('googleapis.com')) {
    return await callGeminiVision(messages, config);
  } else {
    // 默认 OpenAI 格式
    return await callOpenAIVision(messages, config);
  }
}

/**
 * OpenAI Vision 格式
 */
async function callOpenAIVision(messages, config) {
  const url = `${config.baseUrl}/chat/completions`;
  
  const body = {
    model: config.modelId || 'gpt-4o',
    messages: messages,
    max_tokens: 1024
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Gemini Vision 格式
 */
async function callGeminiVision(messages, config) {
  const url = `${config.baseUrl}/${config.modelId || 'gemini-pro-vision'}:generateContent?key=${config.apiKey}`;
  
  // 转换为 Gemini 格式
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      const parts = [];
      if (Array.isArray(m.content)) {
        m.content.forEach(c => {
          if (c.type === 'text') parts.push({ text: c.text });
          if (c.type === 'image_url') {
            // Base64 → inline data
            const match = c.image_url.url.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2]
                }
              });
            }
          }
        });
      } else {
        parts.push({ text: m.content });
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });
  
  const body = {
    contents: contents,
    generationConfig: { maxOutputTokens: 1024 }
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ============================================================
// UI Helpers
// ============================================================

function addMessage(sender, text) {
  const history = document.getElementById('chat-history');
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  
  const label = sender === 'user' ? '你' : sender === 'tutor' ? '明日香' : '';
  
  div.innerHTML = `
    ${label ? `<div class="message-sender">${label}</div>` : ''}
    <div class="bubble">${text}</div>
  `;
  
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
  return div;
}

function updateEmotion(emotion) {
  const emojiMap = { happy: '😊', neutral: '😐', annoyed: '😤', impressed: '😮', angry: '😡' };
  const face = document.querySelector('.tutor-face');
  const emLabel = document.getElementById('tutor-emotion');
  if (face) face.textContent = emojiMap[emotion] || '😐';
  if (emLabel) {
    const labels = { happy: '😊 满意', neutral: '😐 中立', annoyed: '😤 恼怒', impressed: '😮 惊叹', angry: '😡 生气' };
    emLabel.textContent = labels[emotion] || '😐 中立';
  }
}

function parseResponse(rawText) {
  try {
    const match = rawText.match(/```json\s*([\s\S]*?)```/);
    if (match) {
      const parsed = JSON.parse(match[1]);
      const responseText = rawText.replace(/```json[\s\S]*?```/g, '').trim();
      return { response: parsed.response || responseText, emotion: parsed.emotion || 'neutral', logic_score_delta: parsed.logic_score_delta || 0 };
    }
  } catch (e) {}
  return { response: rawText, emotion: 'neutral', logic_score_delta: 0 };
}
