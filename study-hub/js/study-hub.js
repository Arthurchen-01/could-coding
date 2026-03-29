/* Study Hub — 全局悬浮插件化 v2 */

// ============================================================
// State
// ============================================================

let imageBase64 = null;
let imageContextLoaded = false;
let conversationHistory = [];
let currentFileType = null;  // 'image' | 'pdf'

let isFloatMode = false;
let isRecording = false;
let recognition = null;

// ============================================================
// Init
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  bindUpload();
  bindActions();
  bindChat();
  bindResizer();
  bindSpeechRecognition();
  bindFloatSync();
});

// ============================================================
// 1. Upload & 文件处理（图片 + PDF 原生渲染）
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

  input.addEventListener('change', (e) => {
    if (e.target.files[0]) processFile(e.target.files[0]);
  });

  // 清除按钮
  document.getElementById('clear-material').addEventListener('click', clearMaterial);
  document.getElementById('clear-pdf').addEventListener('click', clearMaterial);

  // 图片缩放
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
    // 图片 → Base64 → 图片预览
    const reader = new FileReader();
    reader.onload = (e) => {
      imageBase64 = e.target.result;
      currentFileType = 'image';
      showImagePreview(imageBase64);
      enableChat();
      updateStatus('已加载', 'loaded');
    };
    reader.readAsDataURL(file);

  } else if (file.type === 'application/pdf') {
    // PDF → 原生 embed 渲染
    currentFileType = 'pdf';
    const url = URL.createObjectURL(file);
    showPdfPreview(url);
    enableChat();
    updateStatus('PDF 已加载', 'loaded');

    // PDF 无法直接给 AI 阅读，提示用户
    addMessage('system', '📄 PDF 已在左侧原生打开。如需 AI 阅读内容，请截图关键页面上传。');
  }
}

function showImagePreview(src) {
  document.getElementById('upload-area').style.display = 'none';
  document.getElementById('pdf-area').style.display = 'none';
  document.getElementById('preview-area').style.display = 'flex';
  document.getElementById('preview-image').src = src;
  imageContextLoaded = false;
  document.getElementById('context-indicator').style.display = 'none';
}

function showPdfPreview(url) {
  document.getElementById('upload-area').style.display = 'none';
  document.getElementById('preview-area').style.display = 'none';
  document.getElementById('pdf-area').style.display = 'flex';
  document.getElementById('pdf-embed').src = url;
  imageContextLoaded = false;
  document.getElementById('context-indicator').style.display = 'none';
}

function clearMaterial() {
  imageBase64 = null;
  imageContextLoaded = false;
  currentFileType = null;
  document.getElementById('upload-area').style.display = 'flex';
  document.getElementById('preview-area').style.display = 'none';
  document.getElementById('pdf-area').style.display = 'none';
  document.getElementById('context-indicator').style.display = 'none';
  disableChat();
  updateStatus('未加载', '');
}

function enableChat() {
  document.getElementById('chat-input').disabled = false;
  document.getElementById('send-btn').disabled = false;
  document.getElementById('silent-read-btn').disabled = false;
  document.getElementById('test-me-btn').disabled = false;
  // 浮动窗口同步
  document.getElementById('float-chat-input').disabled = false;
  document.getElementById('float-send-btn').disabled = false;
  document.getElementById('float-silent-read-btn').disabled = false;
  document.getElementById('float-test-me-btn').disabled = false;
}

function disableChat() {
  document.getElementById('chat-input').disabled = true;
  document.getElementById('send-btn').disabled = true;
  document.getElementById('silent-read-btn').disabled = true;
  document.getElementById('test-me-btn').disabled = true;
  document.getElementById('float-chat-input').disabled = true;
  document.getElementById('float-send-btn').disabled = true;
  document.getElementById('float-silent-read-btn').disabled = true;
  document.getElementById('float-test-me-btn').disabled = true;
}

function updateStatus(text, className) {
  const el = document.getElementById('material-status');
  el.textContent = text;
  el.className = 'material-status ' + (className || '');
}

// ============================================================
// 2. Action Buttons
// ============================================================

function bindActions() {
  document.getElementById('silent-read-btn').addEventListener('click', silentRead);
  document.getElementById('test-me-btn').addEventListener('click', socraticTest);
  document.getElementById('float-silent-read-btn').addEventListener('click', silentRead);
  document.getElementById('float-test-me-btn').addEventListener('click', socraticTest);
}

async function silentRead() {
  if (!imageBase64) return;

  const btn = document.getElementById('silent-read-btn');
  const fbtn = document.getElementById('float-silent-read-btn');
  btn.disabled = true; btn.textContent = '👀 阅读中...';
  fbtn.disabled = true; fbtn.textContent = '👀 阅读中...';

  const config = loadConfig();
  const messages = [{
    role: 'user',
    content: [
      { type: 'text', text: '你现在只需要阅读并记住这张图里的所有知识点、公式和文字。回复"已阅，已记住图中内容。"即可，不要多说话。' },
      { type: 'image_url', image_url: { url: imageBase64 } }
    ]
  }];

  try {
    await callVisionAPI(messages, config);
    imageContextLoaded = true;
    document.getElementById('context-indicator').style.display = 'flex';
    updateStatus('AI 已阅读', 'ai-read');
    addMessage('system', '✅ 明日香已阅读并记住当前材料。你现在可以提问了！');
  } catch (error) {
    addMessage('system', `❌ 阅读失败：${error.message}`);
  }

  btn.disabled = false; btn.textContent = '👀 让导师看这页';
  fbtn.disabled = false; fbtn.textContent = '👀 让导师看这页';
}

async function socraticTest() {
  if (!imageBase64) return;

  const btn = document.getElementById('test-me-btn');
  const fbtn = document.getElementById('float-test-me-btn');
  btn.disabled = true; btn.textContent = '🎯 出题中...';
  fbtn.disabled = true; fbtn.textContent = '🎯 出题中...';

  const config = loadConfig();
  const messages = [{
    role: 'user',
    content: [
      { type: 'text', text: '根据这张图里的知识点，向我提出一个极其刁钻的底层逻辑问题。绝对禁止直接给答案！用苏格拉底式提问，一步步反问我，引导我自己发现答案。\n\n返回格式：{"response":"你的问题","emotion":"neutral","logic_score_delta":0}' },
      { type: 'image_url', image_url: { url: imageBase64 } }
    ]
  }];

  try {
    const rawText = await callVisionAPI(messages, config);
    const parsed = parseResponse(rawText);
    addMessage('tutor', parsed.response);
    if (parsed.emotion) updateEmotion(parsed.emotion);
  } catch (error) {
    addMessage('tutor', `（明日香皱眉）出题失败：${error.message}`);
  }

  btn.disabled = false; btn.textContent = '🎯 考考我';
  fbtn.disabled = false; fbtn.textContent = '🎯 考考我';
}

// ============================================================
// 3. Chat
// ============================================================

function bindChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const fInput = document.getElementById('float-chat-input');
  const fSendBtn = document.getElementById('float-send-btn');

  sendBtn.addEventListener('click', () => handleSend(input));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSend(input); });
  fSendBtn.addEventListener('click', () => handleSend(fInput));
  fInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSend(fInput); });
}

async function handleSend(inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage('user', text);
  inputEl.value = '';
  conversationHistory.push({ role: 'user', content: text });

  const thinking = addMessage('tutor', '（明日香正在思考...）');
  const config = loadConfig();

  const messages = [];
  messages.push({
    role: 'system',
    content: config.systemPrompt || '你是一个傲娇的天才少女导师。用苏格拉底式提问引导学习，禁止直接给答案。返回JSON格式。'
  });

  if (imageBase64 && imageContextLoaded) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: '这是我的学习材料：' },
        { type: 'image_url', image_url: { url: imageBase64 } }
      ]
    });
  }

  conversationHistory.slice(-4).forEach(h => messages.push(h));
  messages.push({ role: 'user', content: text });

  try {
    let rawText;
    if (imageBase64 && !imageContextLoaded) {
      rawText = await callVisionAPI(messages, config);
    } else {
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
// 4. Vision API
// ============================================================

async function callVisionAPI(messages, config) {
  if (!config.apiKey) throw new Error('API Key 未配置');
  if (config.baseUrl.includes('googleapis.com')) {
    return await callGeminiVision(messages, config);
  } else {
    return await callOpenAIVision(messages, config);
  }
}

async function callOpenAIVision(messages, config) {
  const url = `${config.baseUrl}/chat/completions`;
  const body = { model: config.modelId || 'gpt-4o', messages, max_tokens: 1024 };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGeminiVision(messages, config) {
  const url = `${config.baseUrl}/${config.modelId || 'gemini-pro-vision'}:generateContent?key=${config.apiKey}`;
  const contents = messages.filter(m => m.role !== 'system').map(m => {
    const parts = [];
    if (Array.isArray(m.content)) {
      m.content.forEach(c => {
        if (c.type === 'text') parts.push({ text: c.text });
        if (c.type === 'image_url') {
          const match = c.image_url.url.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      });
    } else {
      parts.push({ text: m.content });
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });
  const body = { contents, generationConfig: { maxOutputTokens: 1024 } };
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ============================================================
// 5. 可拖拽分割线
// ============================================================

function bindResizer() {
  const resizer = document.getElementById('resizer');
  const materialPanel = document.getElementById('materialPanel');
  const studyHub = document.getElementById('studyHub');
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const rect = studyHub.getBoundingClientRect();
    let ratio = ((e.clientX - rect.left) / rect.width) * 100;
    ratio = Math.max(20, Math.min(75, ratio));
    materialPanel.style.width = ratio + '%';
    materialPanel.style.flex = 'none';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizer.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // 触屏
  resizer.addEventListener('touchstart', (e) => { isResizing = true; resizer.classList.add('active'); e.preventDefault(); });
  document.addEventListener('touchmove', (e) => {
    if (!isResizing) return;
    const touch = e.touches[0];
    const rect = studyHub.getBoundingClientRect();
    let ratio = ((touch.clientX - rect.left) / rect.width) * 100;
    ratio = Math.max(20, Math.min(75, ratio));
    materialPanel.style.width = ratio + '%';
    materialPanel.style.flex = 'none';
  });
  document.addEventListener('touchend', () => { if (isResizing) { isResizing = false; resizer.classList.remove('active'); } });
}

// ============================================================
// 6. Web Speech API 语音输入
// ============================================================

function bindSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    const target = isFloatMode
      ? document.getElementById('float-chat-input')
      : document.getElementById('chat-input');
    target.value = transcript;
  };

  recognition.onerror = () => stopRecording();
  recognition.onend = () => { if (isRecording) { try { recognition.start(); } catch(_){} } };

  document.getElementById('btn-mic').addEventListener('click', toggleRecording);
  document.getElementById('float-btn-mic').addEventListener('click', toggleRecording);
}

function toggleRecording() {
  if (!recognition) { alert('当前浏览器不支持语音识别，请使用 Chrome 或 Edge。'); return; }
  isRecording ? stopRecording() : startRecording();
}

function startRecording() {
  isRecording = true;
  document.getElementById('btn-mic').classList.add('recording');
  document.getElementById('float-btn-mic').classList.add('recording');
  try { recognition.start(); } catch(_){}
}

function stopRecording() {
  isRecording = false;
  document.getElementById('btn-mic').classList.remove('recording');
  document.getElementById('float-btn-mic').classList.remove('recording');
  try { recognition.stop(); } catch(_){}
}

// ============================================================
// 7. 浮动窗口模式
// ============================================================

function bindFloatSync() {
  // 拖拽
  const widget = document.getElementById('floatingWidget');
  const header = document.getElementById('floatHeader');
  let isDragging = false, offX = 0, offY = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.float-ctrl-btn')) return;
    isDragging = true;
    const rect = widget.getBoundingClientRect();
    widget.style.right = 'auto'; widget.style.bottom = 'auto';
    widget.style.left = rect.left + 'px'; widget.style.top = rect.top + 'px';
    offX = e.clientX - rect.left; offY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let x = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - offX));
    let y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - offY));
    widget.style.left = x + 'px'; widget.style.top = y + 'px';
  });
  document.addEventListener('mouseup', () => { isDragging = false; });

  // 触屏拖拽
  header.addEventListener('touchstart', (e) => {
    if (e.target.closest('.float-ctrl-btn')) return;
    isDragging = true;
    const touch = e.touches[0];
    const rect = widget.getBoundingClientRect();
    widget.style.right = 'auto'; widget.style.bottom = 'auto';
    widget.style.left = rect.left + 'px'; widget.style.top = rect.top + 'px';
    offX = touch.clientX - rect.left; offY = touch.clientY - rect.top;
  });
  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    let x = Math.max(0, Math.min(window.innerWidth - 100, touch.clientX - offX));
    let y = Math.max(0, Math.min(window.innerHeight - 60, touch.clientY - offY));
    widget.style.left = x + 'px'; widget.style.top = y + 'px';
  });
  document.addEventListener('touchend', () => { isDragging = false; });

  // 悬浮球
  document.getElementById('floatingBall').addEventListener('click', () => {
    if (isFloatMode) {
      document.getElementById('floatingWidget').classList.add('visible');
      document.getElementById('floatingBall').classList.add('hidden');
    } else {
      enterFloatMode();
    }
  });
}

window.enterFloatMode = function () {
  isFloatMode = true;
  // 隐藏右侧面板
  document.getElementById('chatPanel').style.display = 'none';
  document.getElementById('resizer').style.display = 'none';
  document.getElementById('materialPanel').style.flex = '1';
  document.getElementById('materialPanel').style.width = '100%';

  // 同步消息
  syncMessages();
  document.getElementById('floatingWidget').classList.add('visible');
  document.getElementById('floatingBall').classList.add('hidden');
};

window.exitFloatMode = function () {
  isFloatMode = false;
  document.getElementById('chatPanel').style.display = 'flex';
  document.getElementById('resizer').style.display = '';
  document.getElementById('materialPanel').style.flex = '';
  document.getElementById('materialPanel').style.width = 'var(--split-ratio)';

  syncMessages();
  document.getElementById('floatingWidget').classList.remove('visible');
  document.getElementById('floatingBall').classList.remove('hidden');
};

window.minimizeFloat = function () {
  document.getElementById('floatingWidget').classList.remove('visible');
  document.getElementById('floatingBall').classList.remove('hidden');
};

function syncMessages() {
  const main = document.getElementById('chat-history');
  const floater = document.getElementById('float-chat-history');
  if (isFloatMode) {
    floater.innerHTML = main.innerHTML;
    floater.scrollTop = floater.scrollHeight;
  }
}

// ============================================================
// UI Helpers
// ============================================================

function addMessage(sender, text) {
  const history = document.getElementById('chat-history');
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  const label = sender === 'user' ? '你' : sender === 'tutor' ? '明日香' : '';
  div.innerHTML = `${label ? `<div class="message-sender">${label}</div>` : ''}<div class="bubble">${text}</div>`;
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;

  // 同步到浮动窗口
  if (isFloatMode) {
    const floater = document.getElementById('float-chat-history');
    const clone = div.cloneNode(true);
    floater.appendChild(clone);
    floater.scrollTop = floater.scrollHeight;
  }

  return div;
}

function updateEmotion(emotion) {
  const emojiMap = { happy: '😊', neutral: '😐', annoyed: '😤', impressed: '😮', angry: '😡' };
  const labels = { happy: '😊 满意', neutral: '😐 中立', annoyed: '😤 恼怒', impressed: '😮 惊叹', angry: '😡 生气' };
  document.querySelectorAll('.tutor-face').forEach(f => f.textContent = emojiMap[emotion] || '😐');
  const emLabel = document.getElementById('tutor-emotion');
  if (emLabel) emLabel.textContent = labels[emotion] || '😐 中立';
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
