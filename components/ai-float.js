/* 全局 AI 浮窗 — JS */

(function () {
  'use strict';

  const STORAGE_KEY = 'ai-float-position';
  const CONFIG_KEY = 'api-config';
  const DEFAULT_SIZE = { width: 400, height: 550 };
  const MIN_SIZE = { width: 300, height: 400 };
  const BUTTON_SIZE = 56;

  // ── Helpers ──
  function loadPosition() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p.x === 'number' && typeof p.y === 'number' &&
          typeof p.width === 'number' && typeof p.height === 'number') return p;
    } catch { /* */ }
    return null;
  }

  function savePosition() {
    if (!panel.classList.contains('visible')) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      x: parseInt(panel.style.left, 10),
      y: parseInt(panel.style.top, 10),
      width: panel.offsetWidth,
      height: panel.offsetHeight,
      minimized: false,
    }));
  }

  function saveMinimized() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ minimized: true }));
  }

  function getDefaultPosition() {
    return {
      x: window.innerWidth - DEFAULT_SIZE.width - 24,
      y: window.innerHeight - DEFAULT_SIZE.height - 24,
      width: DEFAULT_SIZE.width,
      height: DEFAULT_SIZE.height,
    };
  }

  function isOnScreen(x, y, w, h) {
    return x + w > 0 && y + h > 0 && x < window.innerWidth && y < window.innerHeight;
  }

  function applyPosition(pos) {
    const safe = pos && !pos.minimized && isOnScreen(pos.x, pos.y, pos.width, pos.height)
      ? pos : getDefaultPosition();
    panel.style.left = safe.x + 'px';
    panel.style.top = safe.y + 'px';
    panel.style.width = (safe.width || DEFAULT_SIZE.width) + 'px';
    panel.style.height = (safe.height || DEFAULT_SIZE.height) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function getPersonaName() {
    try {
      const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
      return cfg.personaName || cfg.persona || '';
    } catch { return ''; }
  }

  function updateHeaderTitle() {
    const name = getPersonaName();
    headerTitle.textContent = name ? `🤖 ${name}` : '🤖 AI 学习伴侣';
  }

  // ── Build UI ──
  function buildUI() {
    const trigger = document.createElement('button');
    trigger.className = 'ai-float-trigger';
    trigger.textContent = '🤖';
    trigger.title = 'AI 导师 (Ctrl+J)';
    document.body.appendChild(trigger);

    const panel = document.createElement('div');
    panel.className = 'ai-float-panel';
    panel.innerHTML = `
      <div class="ai-float-header">
        <h3>🤖 AI 学习伴侣</h3>
        <div class="ai-float-header-actions">
          <button class="ai-float-minimize" title="最小化">─</button>
          <button class="ai-float-close" title="关闭">✕</button>
        </div>
      </div>
      <div class="ai-float-messages">
        <div class="ai-msg system">👋 我是你的 AI 学习伴侣！<br>输入问题、粘贴图片（Ctrl+V）、或上传文件开始。</div>
      </div>
      <div class="ai-float-image-preview">
        <img id="ai-preview-img" src="" alt="">
        <button class="remove-img">移除</button>
      </div>
      <div class="ai-float-input-area">
        <div class="ai-float-input-row">
          <textarea class="ai-float-input" placeholder="输入问题，或 Ctrl+V 粘贴图片..." rows="1"></textarea>
          <div class="ai-float-actions">
            <input type="file" id="ai-file-input" accept="image/*,.pdf" hidden>
            <button class="ai-float-file-btn" title="上传文件">📎</button>
            <button class="ai-float-voice-btn" title="语音输入">🎤</button>
            <button class="ai-float-send" title="发送">➤</button>
          </div>
        </div>
      </div>
      <div class="ai-float-resize"></div>
    `;
    document.body.appendChild(panel);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = (document.querySelector('[data-base]')?.dataset.base || '.') + '/components/ai-float.css';
    document.head.appendChild(link);

    return { trigger, panel };
  }

  // ── State ──
  let isOpen = false;
  let attachedImage = null;
  let isFileLoading = false;
  let isVoiceActive = false;
  let recognition = null;
  let chatHistory = [];

  const SYSTEM_PROMPT = '你是一个友好的 AP 学习助手。用简洁的中文回答问题。如果是英文题目，可以用中文解释。用户可能会给你图片、PDF截图或选中的文字，请基于这些内容回答。';

  // ── Init ──
  const { trigger, panel } = buildUI();
  const headerTitle = panel.querySelector('.ai-float-header h3');
  const messagesEl = panel.querySelector('.ai-float-messages');
  const inputEl = panel.querySelector('.ai-float-input');
  const sendBtn = panel.querySelector('.ai-float-send');
  const closeBtn = panel.querySelector('.ai-float-close');
  const minimizeBtn = panel.querySelector('.ai-float-minimize');
  const previewArea = panel.querySelector('.ai-float-image-preview');
  const previewImg = panel.querySelector('#ai-preview-img');
  const removeImgBtn = panel.querySelector('.remove-img');
  const resizeHandle = panel.querySelector('.ai-float-resize');
  const voiceBtn = panel.querySelector('.ai-float-voice-btn');
  const fileBtn = panel.querySelector('.ai-float-file-btn');
  const fileInput = panel.querySelector('#ai-file-input');

  // ── Open / Close / Minimize ──
  function showWindow() {
    isOpen = true;
    panel.classList.add('visible');
    trigger.classList.add('hidden');
    const pos = loadPosition();
    applyPosition(pos);
    updateHeaderTitle();
    inputEl.focus();
  }

  function hideWindow() {
    if (isVoiceActive) stopVoice();
    isOpen = false;
    panel.classList.remove('visible');
    trigger.classList.remove('hidden');
    saveMinimized();
  }

  function minimizeWindow() {
    savePosition();
    if (isVoiceActive) stopVoice();
    isOpen = false;
    panel.classList.remove('visible');
    trigger.classList.remove('hidden');
    const pos = loadPosition();
    if (pos && !pos.minimized) {
      trigger.style.left = 'auto';
      trigger.style.top = 'auto';
      trigger.style.right = (window.innerWidth - pos.x - pos.width + 8) + 'px';
      trigger.style.bottom = (window.innerHeight - pos.y - pos.height + 8) + 'px';
    } else {
      trigger.style.left = 'auto';
      trigger.style.top = 'auto';
      trigger.style.right = '24px';
      trigger.style.bottom = '24px';
    }
    saveMinimized();
  }

  trigger.addEventListener('click', () => showWindow());
  closeBtn.addEventListener('click', () => { savePosition(); hideWindow(); });
  minimizeBtn.addEventListener('click', minimizeWindow);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
      e.preventDefault();
      if (isOpen) { savePosition(); hideWindow(); } else showWindow();
    }
    if (e.key === 'Escape' && isOpen) { savePosition(); hideWindow(); }
  });

  const saved = loadPosition();
  if (saved && !saved.minimized) showWindow();

  // ── Dragging ──
  const header = panel.querySelector('.ai-float-header');
  let dragState = null;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    panel.classList.add('dragging');
    dragState = {
      startX: e.clientX, startY: e.clientY,
      origLeft: parseInt(panel.style.left, 10) || 0,
      origTop: parseInt(panel.style.top, 10) || 0,
    };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
  });

  header.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    const t = e.touches[0];
    panel.classList.add('dragging');
    dragState = {
      startX: t.clientX, startY: t.clientY,
      origLeft: parseInt(panel.style.left, 10) || 0,
      origTop: parseInt(panel.style.top, 10) || 0,
    };
    document.addEventListener('touchmove', onDragTouch, { passive: false });
    document.addEventListener('touchend', onDragEnd);
  }, { passive: true });

  function onDrag(e) {
    if (!dragState) return;
    panel.style.left = (dragState.origLeft + e.clientX - dragState.startX) + 'px';
    panel.style.top = (dragState.origTop + e.clientY - dragState.startY) + 'px';
  }

  function onDragTouch(e) {
    if (!dragState) return;
    e.preventDefault();
    const t = e.touches[0];
    panel.style.left = (dragState.origLeft + t.clientX - dragState.startX) + 'px';
    panel.style.top = (dragState.origTop + t.clientY - dragState.startY) + 'px';
  }

  function onDragEnd() {
    dragState = null;
    panel.classList.remove('dragging');
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragTouch);
    document.removeEventListener('touchend', onDragEnd);
    savePosition();
  }

  // ── Resizing ──
  let resizeState = null;

  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    resizeState = {
      startX: e.clientX, startY: e.clientY,
      origW: panel.offsetWidth, origH: panel.offsetHeight,
    };
    panel.classList.add('dragging');
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', onResizeEnd);
  });

  resizeHandle.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    const t = e.touches[0];
    resizeState = {
      startX: t.clientX, startY: t.clientY,
      origW: panel.offsetWidth, origH: panel.offsetHeight,
    };
    panel.classList.add('dragging');
    document.addEventListener('touchmove', onResizeTouch, { passive: false });
    document.addEventListener('touchend', onResizeEnd);
  }, { passive: true });

  function onResize(e) {
    if (!resizeState) return;
    panel.style.width = Math.max(MIN_SIZE.width, resizeState.origW + e.clientX - resizeState.startX) + 'px';
    panel.style.height = Math.max(MIN_SIZE.height, resizeState.origH + e.clientY - resizeState.startY) + 'px';
  }

  function onResizeTouch(e) {
    if (!resizeState) return;
    e.preventDefault();
    const t = e.touches[0];
    panel.style.width = Math.max(MIN_SIZE.width, resizeState.origW + t.clientX - resizeState.startX) + 'px';
    panel.style.height = Math.max(MIN_SIZE.height, resizeState.origH + t.clientY - resizeState.startY) + 'px';
  }

  function onResizeEnd() {
    resizeState = null;
    panel.classList.remove('dragging');
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', onResizeEnd);
    document.removeEventListener('touchmove', onResizeTouch);
    document.removeEventListener('touchend', onResizeEnd);
    savePosition();
  }

  // ── Send ──
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  // ── Image paste ──
  document.addEventListener('paste', (e) => {
    if (!isOpen) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        handleImageAttach(item.getAsFile());
        break;
      }
    }
  });

  removeImgBtn.addEventListener('click', () => {
    attachedImage = null;
    previewArea.style.display = 'none';
    previewImg.src = '';
  });

  function handleImageAttach(blob) {
    const reader = new FileReader();
    reader.onload = (e) => {
      attachedImage = e.target.result;
      previewImg.src = attachedImage;
      previewArea.style.display = 'block';
    };
    reader.readAsDataURL(blob);
  }

  // ── File upload ──
  fileBtn.addEventListener('click', () => {
    if (isFileLoading) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      isFileLoading = true;
      sendBtn.disabled = true;
      fileBtn.classList.add('loading');

      handleImageAttach(file);

      // Image loads quickly
      setTimeout(() => {
        isFileLoading = false;
        sendBtn.disabled = false;
        fileBtn.classList.remove('loading');
      }, 500);

    } else if (file.type === 'application/pdf') {
      addMessage('system', '📎 PDF 文件已选择，但暂不支持直接读取。请截图后粘贴。');
    }

    fileInput.value = '';
  });

  // ── Voice input ──
  voiceBtn.addEventListener('click', toggleVoice);

  function toggleVoice() {
    if (isVoiceActive) {
      stopVoice();
    } else {
      startVoice();
    }
  }

  function startVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addMessage('system', '⚠️ 当前浏览器不支持语音输入');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    recognition.lang = config.lang || 'zh-CN';

    recognition.onstart = () => {
      isVoiceActive = true;
      voiceBtn.classList.add('listening');
      sendBtn.classList.add('hidden-by-voice');
      inputEl.placeholder = '正在听...';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      inputEl.value = transcript;
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    };

    recognition.onerror = (event) => {
      console.error('Voice error:', event.error);
      stopVoice();
    };

    recognition.onend = () => {
      stopVoice();
    };

    recognition.start();
  }

  function stopVoice() {
    isVoiceActive = false;
    voiceBtn.classList.remove('listening');
    sendBtn.classList.remove('hidden-by-voice');
    inputEl.placeholder = '输入问题，或 Ctrl+V 粘贴图片...';
    if (recognition) {
      try { recognition.stop(); } catch { /* */ }
      recognition = null;
    }
  }

  // ── Messages ──
  function addMessage(role, content, image) {
    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    if (image) {
      div.innerHTML = `<img src="${image}" alt="attached"><br>${escapeHtml(content)}`;
    } else {
      div.textContent = content;
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  async function sendMessage() {
    if (isFileLoading) return;
    const text = inputEl.value.trim();
    if (!text && !attachedImage) return;

    if (!window.callAI) {
      addMessage('system', '⚠️ AI 未配置。请在设置中填写 API Key。');
      return;
    }

    addMessage('user', text || '[图片]', attachedImage || null);
    const imageToSend = attachedImage;
    attachedImage = null;
    previewArea.style.display = 'none';
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    messages.push(...chatHistory.slice(-10));
    messages.push({ role: 'user', content: text || '请分析这张图片' });

    const loadingEl = addMessage('ai', '思考中...');

    try {
      let reply;
      if (imageToSend) {
        reply = await window.askAIWithImage(text || '请分析这张图片', imageToSend, SYSTEM_PROMPT);
      } else {
        reply = await window.callAI(messages);
      }
      loadingEl.textContent = reply;
      chatHistory.push({ role: 'user', content: text || '[图片]' });
      chatHistory.push({ role: 'assistant', content: reply });
    } catch (e) {
      loadingEl.textContent = `❌ ${e.message}`;
    }

    sendBtn.disabled = false;
    inputEl.focus();
  }

  // ── Settings sync ──
  window.addEventListener('storage', (e) => {
    if (e.key === CONFIG_KEY) updateHeaderTitle();
  });

  console.log('[AI Float] 浮窗已加载。Ctrl+J 切换。');
})();

  // ── TTS 语音播放 ──
  async function speakText(text) {
    const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    const provider = config.ttsProvider || 'browser';

    if (provider === 'browser') {
      // Browser built-in TTS
      if (!('speechSynthesis' in window)) {
        addMessage('system', '⚠️ 当前浏览器不支持语音合成');
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = config.lang || 'zh-CN';
      utter.rate = 1;
      window.speechSynthesis.speak(utter);
      return;
    }

    // OpenAI or Custom TTS
    const apiKey = config.apiKey || '';
    const ttsUrl = config.ttsUrl || 'https://api.openai.com/v1/audio/speech';

    if (!apiKey) {
      addMessage('system', '⚠️ TTS 需要 API Key。请在设置中配置，或切换为"浏览器内置"。');
      return;
    }

    try {
      const resp = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text.substring(0, 4096),
          voice: 'nova',
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || `TTS API 错误: ${resp.status}`);
      }

      const blob = await resp.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.play();
    } catch (e) {
      addMessage('system', `❌ TTS 失败: ${e.message}\n👉 检查 API Key 或切换为"浏览器内置"。`);
    }
  }

  // Add speaker button to AI messages
  const origAddMessage = addMessage;
  addMessage = function(role, content, image) {
    const div = origAddMessage(role, content, image);
    if (role === 'ai' && content && content !== '思考中...') {
      const btn = document.createElement('button');
      btn.className = 'ai-float-tts-btn';
      btn.textContent = '🔊';
      btn.title = '朗读';
      btn.addEventListener('click', () => speakText(content));
      div.appendChild(btn);
    }
    return div;
  };
