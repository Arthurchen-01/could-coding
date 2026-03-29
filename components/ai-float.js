/* 全局 AI 悬浮面板 — JS */

(function() {
  'use strict';

  // ============================================================
  // 创建 DOM
  // ============================================================
  function createPanel() {
    // 悬浮触发按钮
    const trigger = document.createElement('button');
    trigger.className = 'ai-float-trigger';
    trigger.textContent = '🤖 AI';
    trigger.title = 'AI 导师 (Ctrl+J)';
    document.body.appendChild(trigger);

    // 面板
    const panel = document.createElement('div');
    panel.className = 'ai-float-panel';
    panel.innerHTML = `
      <div class="ai-float-header">
        <h3>🤖 AI 学习伴侣</h3>
        <button class="ai-float-close" title="关闭">✕</button>
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
    `;
    document.body.appendChild(panel);

    // 注入 CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = (document.querySelector('[data-base]')?.dataset.base || '.') + '/components/ai-float.css';
    document.head.appendChild(link);

    return { trigger, panel };
  }

  // ============================================================
  // 状态
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
  // 初始化
  // ============================================================
  const { trigger, panel } = createPanel();
  const messagesEl = panel.querySelector('.ai-float-messages');
  const inputEl = panel.querySelector('.ai-float-input');
  const sendBtn = panel.querySelector('.ai-float-send');
  const closeBtn = panel.querySelector('.ai-float-close');
  const dropzone = panel.querySelector('.ai-float-dropzone');
  const previewArea = panel.querySelector('.ai-float-image-preview');
  const previewImg = panel.querySelector('#ai-preview-img');
  const removeImgBtn = panel.querySelector('.remove-img');

  // 打开/关闭
  trigger.addEventListener('click', () => togglePanel(true));
  closeBtn.addEventListener('click', () => togglePanel(false));

  function togglePanel(open) {
    isOpen = open;
    panel.classList.toggle('open', open);
    trigger.style.display = open ? 'none' : '';
    if (open) inputEl.focus();
  }

  // 快捷键 Ctrl+J
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
      e.preventDefault();
      togglePanel(!isOpen);
    }
    if (e.key === 'Escape' && isOpen) togglePanel(false);
  });

  // 模式切换
  panel.querySelectorAll('.ai-float-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.ai-float-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      if (currentMode === 'screen') captureScreen();
    });
  });

  // 发送消息
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 自动调整输入框高度
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  // ============================================================
  // 图片粘贴 & 拖拽
  // ============================================================
  document.addEventListener('paste', (e) => {
    if (!isOpen) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        handleImageAttach(blob);
        break;
      }
    }
  });

  // 拖拽
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageAttach(file);
    }
  });

  // 显示/隐藏拖拽区
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
  // 截屏
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
    } catch (e) {
      addMessage('system', '❌ 截屏取消或不支持');
    }
  }

  // ============================================================
  // 消息处理
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

    // 检查 API 是否配置
    if (!window.callAI) {
      addMessage('system', '⚠️ AI 功能未配置。请先部署 Cloudflare Worker 并配置 js/ai-proxy.js');
      return;
    }

    // 用户消息
    addMessage('user', text || '[图片]', attachedImage ? attachedImage : null);
    const imageToSend = attachedImage;
    attachedImage = null;
    previewArea.style.display = 'none';
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    // 构建消息历史
    const systemPrompt = SYSTEM_PROMPTS[currentMode] || SYSTEM_PROMPTS.chat;
    const messages = [{ role: 'system', content: systemPrompt }];
    
    // 添加最近对话上下文（最近5轮）
    const recent = chatHistory.slice(-10);
    messages.push(...recent);
    messages.push({ role: 'user', content: text || '请分析这张图片' });

    // loading
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
  // 页面内容提取（用于解题模式）
  // ============================================================
  function getPageContext() {
    // 尝试获取当前题目内容
    const questionEl = document.querySelector('.question-text, .stem_paragraph, .question');
    if (questionEl) return questionEl.textContent.trim();
    
    // 获取选中的文字
    const sel = window.getSelection();
    if (sel.toString().trim()) return sel.toString().trim();
    
    return '';
  }

  // 解题模式自动填充题目
  panel.querySelectorAll('.ai-float-tool-btn[data-mode="explain"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ctx = getPageContext();
      if (ctx) {
        inputEl.value = `请帮我解这道题：\n${ctx}`;
        inputEl.focus();
      }
    });
  });

  console.log('[AI Float] Panel loaded. Ctrl+J to toggle.');
})();
