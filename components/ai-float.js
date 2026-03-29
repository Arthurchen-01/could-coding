/* 全局 AI 浮窗 — JS */

(function () {
  'use strict';

  // ============================================================
  // Constants
  // ============================================================
  const STORAGE_KEY = 'ai-float-position';
  const CONFIG_KEY = 'api-config';
  const DEFAULT_SIZE = { width: 400, height: 550 };
  const MIN_SIZE = { width: 300, height: 400 };
  const BUTTON_SIZE = 56;

  // ============================================================
  // Position / size helpers
  // ============================================================
  function loadPosition() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (
        typeof p.x === 'number' && typeof p.y === 'number' &&
        typeof p.width === 'number' && typeof p.height === 'number'
      ) return p;
    } catch { /* ignore */ }
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
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: vw - DEFAULT_SIZE.width - 24,
      y: vh - DEFAULT_SIZE.height - 24,
      width: DEFAULT_SIZE.width,
      height: DEFAULT_SIZE.height,
    };
  }

  function isOnScreen(x, y, w, h) {
    return x + w > 0 && y + h > 0 && x < window.innerWidth && y < window.innerHeight;
  }

  function applyPosition(pos) {
    const safe = pos && !pos.minimized && isOnScreen(pos.x, pos.y, pos.width, pos.height) ? pos : getDefaultPosition();
    panel.style.left = safe.x + 'px';
    panel.style.top = safe.y + 'px';
    panel.style.width = (safe.width || DEFAULT_SIZE.width) + 'px';
    panel.style.height = (safe.height || DEFAULT_SIZE.height) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  // ============================================================
  // Persona name from settings
  // ============================================================
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

  // ============================================================
  // Create DOM
  // ============================================================
  function buildUI() {
    // Minimized button
    const trigger = document.createElement('button');
    trigger.className = 'ai-float-trigger';
    trigger.textContent = '🤖';
    trigger.title = 'AI 导师 (Ctrl+J)';
    document.body.appendChild(trigger);

    // Floating panel
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
      <div class="ai-float-tools">
        <button class="ai-float-tool-btn active" data-mode="chat">💬 对话</button>
        <button class="ai-float-tool-btn" data-mode="explain">📖 解题</button>
        <button class="ai-float-tool-btn" data-mode="ocr">🔍 OCR</button>
        <button class="ai-float-tool-btn" data-mode="screen">📸 截屏</button>
      </div>
      <div class="ai-float-messages">
        <div class="ai-msg system">👋 我是你的 AI 学习伴侣！<br>可以粘贴图片、截屏、或直接提问。</div>
      </div>
      <div class="ai-float-dropzone">📎 拖拽或粘贴图片到这里</div>
      <div class="ai-float-image-preview">
        <img id="ai-preview-img" src="" alt="">
        <button class="remove-img">移除</button>
      </div>
      <div class="ai-float-input-area">
        <div class="ai-float-input-row">
          <textarea class="ai-float-input" placeholder="输入问题，或 Ctrl+V 粘贴图片..." rows="1"></textarea>
          <button class="ai-float-send">发送</button>
        </div>
      </div>
      <div class="ai-float-resize"></div>
    `;
    document.body.appendChild(panel);

    // Inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = (document.querySelector('[data-base]')?.dataset.base || '.') + '/components/ai-float.css';
    document.head.appendChild(link);

    return { trigger, panel };
  }

  // ============================================================
  // State
  // ============================================================
  let isOpen = false;
  let currentMode = 'chat';
  let attachedImage = null;
  let chatHistory = [];

  const SYSTEM_PROMPTS = {
    chat: '你是一个友好的 AP 学习助手。用简洁的中文回答问题。如果是英文题目，可以用中文解释。',
    explain: '你是一个 AP 考试解题专家。用户会给你题目，请详细解释：1) 题目考什么知识点 2) 解题步骤 3) 正确答案和原因。用中文解释，保留英文术语。',
    ocr: '你是一个 OCR 助手。用户会给你一张图片，请识别其中的所有文字内容，保持原始格式输出。',
    screen: '你是一个屏幕分析助手。用户会给你一张截屏，请分析屏幕上的内容并回答相关问题。',
  };

  // ============================================================
  // Init DOM refs
  // ============================================================
  const { trigger, panel } = buildUI();
  const headerTitle = panel.querySelector('.ai-float-header h3');
  const messagesEl = panel.querySelector('.ai-float-messages');
  const inputEl = panel.querySelector('.ai-float-input');
  const sendBtn = panel.querySelector('.ai-float-send');
  const closeBtn = panel.querySelector('.ai-float-close');
  const minimizeBtn = panel.querySelector('.ai-float-minimize');
  const dropzone = panel.querySelector('.ai-float-dropzone');
  const previewArea = panel.querySelector('.ai-float-image-preview');
  const previewImg = panel.querySelector('#ai-preview-img');
  const removeImgBtn = panel.querySelector('.remove-img');
  const resizeHandle = panel.querySelector('.ai-float-resize');

  // ============================================================
  // Open / Close / Minimize
  // ============================================================
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
    isOpen = false;
    panel.classList.remove('visible');
    trigger.classList.remove('hidden');
    saveMinimized();
  }

  function minimizeWindow() {
    // Save current position, then show the trigger button
    savePosition();
    isOpen = false;
    panel.classList.remove('visible');
    trigger.classList.remove('hidden');
    // position trigger at saved panel bottom-right
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

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
      e.preventDefault();
      if (isOpen) { savePosition(); hideWindow(); } else showWindow();
    }
    if (e.key === 'Escape' && isOpen) { savePosition(); hideWindow(); }
  });

  // Restore on load
  const saved = loadPosition();
  if (saved && !saved.minimized) {
    showWindow();
  }

  // ============================================================
  // Dragging
  // ============================================================
  const header = panel.querySelector('.ai-float-header');
  let dragState = null;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.ai-float-close') || e.target.closest('.ai-float-minimize')) return;
    e.preventDefault();
    panel.classList.add('dragging');
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: parseInt(panel.style.left, 10) || 0,
      origTop: parseInt(panel.style.top, 10) || 0,
    };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
  });

  // Touch support
  header.addEventListener('touchstart', (e) => {
    if (e.target.closest('.ai-float-close') || e.target.closest('.ai-float-minimize')) return;
    const t = e.touches[0];
    panel.classList.add('dragging');
    dragState = {
      startX: t.clientX,
      startY: t.clientY,
      origLeft: parseInt(panel.style.left, 10) || 0,
      origTop: parseInt(panel.style.top, 10) || 0,
    };
    document.addEventListener('touchmove', onDragTouch, { passive: false });
    document.addEventListener('touchend', onDragEnd);
  }, { passive: true });

  function onDrag(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    panel.style.left = (dragState.origLeft + dx) + 'px';
    panel.style.top = (dragState.origTop + dy) + 'px';
  }

  function onDragTouch(e) {
    if (!dragState) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - dragState.startX;
    const dy = t.clientY - dragState.startY;
    panel.style.left = (dragState.origLeft + dx) + 'px';
    panel.style.top = (dragState.origTop + dy) + 'px';
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

  // ============================================================
  // Resizing
  // ============================================================
  let resizeState = null;

  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeState = {
      startX: e.clientX,
      startY: e.clientY,
      origW: panel.offsetWidth,
      origH: panel.offsetHeight,
    };
    panel.classList.add('dragging');
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', onResizeEnd);
  });

  resizeHandle.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    const t = e.touches[0];
    resizeState = {
      startX: t.clientX,
      startY: t.clientY,
      origW: panel.offsetWidth,
      origH: panel.offsetHeight,
    };
    panel.classList.add('dragging');
    document.addEventListener('touchmove', onResizeTouch, { passive: false });
    document.addEventListener('touchend', onResizeEnd);
  }, { passive: true });

  function onResize(e) {
    if (!resizeState) return;
    const w = Math.max(MIN_SIZE.width, resizeState.origW + e.clientX - resizeState.startX);
    const h = Math.max(MIN_SIZE.height, resizeState.origH + e.clientY - resizeState.startY);
    panel.style.width = w + 'px';
    panel.style.height = h + 'px';
  }

  function onResizeTouch(e) {
    if (!resizeState) return;
    e.preventDefault();
    const t = e.touches[0];
    const w = Math.max(MIN_SIZE.width, resizeState.origW + t.clientX - resizeState.startX);
    const h = Math.max(MIN_SIZE.height, resizeState.origH + t.clientY - resizeState.startY);
    panel.style.width = w + 'px';
    panel.style.height = h + 'px';
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

  // ============================================================
  // Mode switching
  // ============================================================
  panel.querySelectorAll('.ai-float-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.ai-float-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      if (currentMode === 'screen') captureScreen();
    });
  });

  // ============================================================
  // Send message
  // ============================================================
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  // ============================================================
  // Image paste & drag
  // ============================================================
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

  dropzone.addEventListener('dragover', (e) => e.preventDefault());
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) handleImageAttach(file);
  });

  inputEl.addEventListener('dragenter', () => dropzone.classList.add('visible'));
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('visible'));
  dropzone.addEventListener('drop', () => dropzone.classList.remove('visible'));

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
      dropzone.classList.remove('visible');
    };
    reader.readAsDataURL(blob);
  }

  // ============================================================
  // Screen capture
  // ============================================================
  async function captureScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      attachedImage = canvas.toDataURL('image/png');
      previewImg.src = attachedImage;
      previewArea.style.display = 'block';
      addMessage('system', '📸 已截取屏幕，可以提问分析');
    } catch {
      addMessage('system', '❌ 截屏取消或不支持');
    }
  }

  // ============================================================
  // Messages
  // ============================================================
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
    const text = inputEl.value.trim();
    if (!text && !attachedImage) return;

    if (!window.callAI) {
      addMessage('system', '⚠️ AI 功能未配置。请先部署 Cloudflare Worker 并配置 js/ai-proxy.js');
      return;
    }

    addMessage('user', text || '[图片]', attachedImage || null);
    const imageToSend = attachedImage;
    attachedImage = null;
    previewArea.style.display = 'none';
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    const systemPrompt = SYSTEM_PROMPTS[currentMode] || SYSTEM_PROMPTS.chat;
    const messages = [{ role: 'system', content: systemPrompt }];
    const recent = chatHistory.slice(-10);
    messages.push(...recent);
    messages.push({ role: 'user', content: text || '请分析这张图片' });

    const loadingEl = addMessage('ai', '思考中...');

    try {
      let reply;
      if (imageToSend) {
        reply = await window.askAIWithImage(text || '请分析这张图片', imageToSend, systemPrompt);
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

  // ============================================================
  // Page context for explain mode
  // ============================================================
  function getPageContext() {
    const questionEl = document.querySelector('.question-text, .stem_paragraph, .question');
    if (questionEl) return questionEl.textContent.trim();
    const sel = window.getSelection();
    if (sel.toString().trim()) return sel.toString().trim();
    return '';
  }

  panel.querySelectorAll('.ai-float-tool-btn[data-mode="explain"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ctx = getPageContext();
      if (ctx) {
        inputEl.value = `请帮我解这道题：\n${ctx}`;
        inputEl.focus();
      }
    });
  });

  // ============================================================
  // Listen for settings changes (persona)
  // ============================================================
  window.addEventListener('storage', (e) => {
    if (e.key === CONFIG_KEY) updateHeaderTitle();
  });

  console.log('[AI Float] Floating window loaded. Ctrl+J to toggle.');
})();
