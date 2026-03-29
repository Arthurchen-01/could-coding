/**
 * workspace.js — Main controller for Study Workspace
 * Ties together: PDFReader, Resizer, SilentReader, QuestionLogger
 */
(function () {
  'use strict';

  // ── State ──
  let pdfReader, resizer, silentReader, questionLogger;
  let isProcessing = false;
  let pdfFileName = '';
  let currentPersona = { name: 'AI Tutor', prompt: 'You are an AI tutor. Use Socratic method to help students understand AP exam material.' };

  // ── DOM Elements ──
  const $ = id => document.getElementById(id);

  const uploadZone = $('upload-zone');
  const workspace = $('workspace');
  const toolbar = $('toolbar');
  const fileInput = $('file-input');
  const uploadBox = uploadZone.querySelector('.upload-box');

  const pdfViewer = $('pdf-viewer');
  const pageCurrent = $('page-current');
  const pageTotal = $('page-total');
  const btnPrev = $('btn-prev');
  const btnNext = $('btn-next');
  const btnZoomIn = $('btn-zoom-in');
  const btnZoomOut = $('btn-zoom-out');
  const zoomLevel = $('zoom-level');
  const pageJump = $('page-jump');

  const leftPanel = $('left-panel');
  const rightPanel = $('right-panel');
  const resizerEl = $('resizer');

  const chatMessages = $('chat-messages');
  const chatInput = $('chat-input');
  const btnSend = $('btn-send');
  const btnVoice = $('btn-voice');
  const personaName = $('persona-name');
  const btnSilentRead = $('btn-silent-read');

  const historyDrawer = $('history-drawer');
  const historyList = $('history-list');
  const historySubjectFilter = $('history-subject-filter');

  // ── Init ──
  async function init() {
    // Initialize PDF reader with container element
    pdfReader = new PDFReader({ container: pdfViewer });

    // Initialize resizer
    resizer = new Resizer(workspace, leftPanel, rightPanel, resizerEl);
    resizer.init();

    // Initialize silent reader
    silentReader = new SilentReader(pdfReader);
    silentReader.restoreFromStorage();

    // Initialize question logger
    questionLogger = new QuestionLogger();
    await questionLogger.init();

    // Load persona settings
    loadPersona();

    // Bind events
    bindEvents();

    // Check if there's a saved PDF URL
    const savedUrl = localStorage.getItem('study-workspace-pdf');
    if (savedUrl) {
      try {
        await loadPDF(savedUrl);
      } catch (e) {
        console.log('No saved PDF found');
      }
    }
  }

  // ── Event Bindings ──
  function bindEvents() {
    // Upload
    uploadBox.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // Drag & drop
    uploadBox.addEventListener('dragover', e => {
      e.preventDefault();
      uploadBox.classList.add('dragover');
    });
    uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragover'));
    uploadBox.addEventListener('drop', e => {
      e.preventDefault();
      uploadBox.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        handleFile(file);
      }
    });

    // Page navigation
    btnPrev.addEventListener('click', async () => {
      await pdfReader.prevPage();
      updatePageInfo();
    });
    btnNext.addEventListener('click', async () => {
      await pdfReader.nextPage();
      updatePageInfo();
    });

    // Zoom controls
    btnZoomIn.addEventListener('click', () => {
      pdfReader.zoomIn();
      updateZoomDisplay();
    });
    btnZoomOut.addEventListener('click', () => {
      pdfReader.zoomOut();
      updateZoomDisplay();
    });

    // Page jump
    pageJump.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const targetPage = parseInt(pageJump.value);
        if (targetPage >= 1 && targetPage <= pdfReader.getTotalPages()) {
          await pdfReader.scrollToPage(targetPage);
          updatePageInfo();
        }
        pageJump.value = '';
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { btnPrev.click(); }
      if (e.key === 'ArrowRight') { btnNext.click(); }
    });

    // Chat
    btnSend.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Silent read
    btnSilentRead.addEventListener('click', silentReadCurrentPage);

    // Voice input
    btnVoice.addEventListener('click', toggleVoiceInput);

    // Toolbar
    $('btn-reset-layout').addEventListener('click', () => resizer.reset());
    $('btn-history').addEventListener('click', toggleHistory);
    $('btn-upload-new').addEventListener('click', () => fileInput.click());
    $('btn-close-drawer').addEventListener('click', () => historyDrawer.classList.add('hidden'));
    $('btn-export-json').addEventListener('click', exportHistory);

    // Window resize
    window.addEventListener('resize', () => {
      if (pdfReader.getTotalPages() > 0) {
        pdfReader.refresh();
      }
    });
  }

  // ── File Handling ──
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
  }

  async function handleFile(file) {
    pdfFileName = file.name;
    const url = URL.createObjectURL(file);
    await loadPDF(url);
    localStorage.setItem('study-workspace-pdf', url);
  }

  async function loadPDF(url) {
    try {
      const pages = await pdfReader.loadFile(url);
      pageTotal.textContent = pages;
      updatePageInfo();
      updateZoomDisplay();
      uploadZone.classList.add('hidden');
      workspace.classList.remove('hidden');
      toolbar.classList.remove('hidden');
      addSystemMessage(`Loaded: ${pdfFileName || 'PDF'} (${pages} pages)`);
    } catch (err) {
      addSystemMessage('Failed to load PDF: ' + err.message);
    }
  }

  // ── Page Info ──
  function updatePageInfo() {
    pageCurrent.textContent = pdfReader.getCurrentPageNum();
    pageTotal.textContent = pdfReader.getTotalPages();
    btnPrev.disabled = pdfReader.getCurrentPageNum() <= 1;
    btnNext.disabled = pdfReader.getCurrentPageNum() >= pdfReader.getTotalPages();
    updateZoomDisplay();
  }

  // ── Zoom Display ──
  function updateZoomDisplay() {
    const viewport = pdfReader.getViewport ? pdfReader.getViewport() : { scale: 1.5 };
    zoomLevel.textContent = viewport.scale.toFixed(1) + 'x';
  }

  // ── Chat ──
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isProcessing) return;

    chatInput.value = '';
    isProcessing = true;

    // Add user message to chat
    addMessage('user', text);

    // Show thinking indicator
    const thinkingEl = addMessage('ai', 'Thinking...', true);

    try {
      // Build prompt with silent reader context
      const prompt = silentReader.buildContextPrompt(text);

      // Get current page context
      const contextId = `pdf-page-${pdfReader.getCurrentPageNum()}`;
      const visionUsed = silentReader.isCached(pdfReader.getCurrentPageNum());

      // Send to AI
      const response = await getAIResponse(prompt);

      // Replace thinking with actual response
      thinkingEl.remove();
      addMessage('ai', response);

      // Log the question
      await questionLogger.log({
        question: text,
        response: response,
        contextId: contextId,
        visionUsed: visionUsed,
        pageSummary: visionUsed ? silentReader.getCachedResult(pdfReader.getCurrentPageNum())?.summary : '',
        persona: currentPersona.name
      });

    } catch (err) {
      thinkingEl.remove();
      addMessage('ai', 'Error: ' + err.message);
    }

    isProcessing = false;
  }

  /**
   * Send message to AI and get response
   */
  async function getAIResponse(prompt) {
    // Try to use existing api-config.js and ai-proxy.js
    if (typeof callAI === 'function') {
      const messages = [
        { role: 'system', content: currentPersona.prompt },
        { role: 'user', content: prompt }
      ];
      return await callAI(messages);
    }

    // Fallback: use fetch directly if API config exists
    const config = JSON.parse(localStorage.getItem('api-config') || '{}');
    if (config.apiKey && config.baseUrl) {
      const response = await fetch(config.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + config.apiKey
        },
        body: JSON.stringify({
          model: config.modelId || 'gpt-4o',
          messages: [
            { role: 'system', content: currentPersona.prompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices[0].message.content;
    }

    throw new Error('AI not configured. Please set up your API key in Settings.');
  }

  // ── Silent Read ──
  async function silentReadCurrentPage() {
    if (!pdfReader.getTotalPages()) return;
    if (silentReader.isReading) return;

    const pageNum = pdfReader.getCurrentPageNum();

    // Check if already cached
    if (silentReader.isCached(pageNum)) {
      addSystemMessage(`Page ${pageNum} already read ✓`);
      return;
    }

    btnSilentRead.classList.add('reading');
    btnSilentRead.textContent = '⏳ Reading...';

    try {
      const result = await silentReader.recognizeCurrentPage();
      if (result) {
        addSystemMessage(`👁️ Read page ${pageNum}: ${result.topic || 'Done'}`);
      }
    } catch (err) {
      addSystemMessage('Failed to read page: ' + err.message);
    }

    btnSilentRead.classList.remove('reading');
    btnSilentRead.textContent = '👁️ Pre-read';
  }

  // ── Voice Input ──
  let recognition = null;

  function toggleVoiceInput() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addSystemMessage('Voice input is not supported in this browser.');
      btnVoice.style.display = 'none';
      return;
    }

    if (recognition) {
      recognition.stop();
      recognition = null;
      btnVoice.classList.remove('listening');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    // Read language from settings config
    const speechConfig = JSON.parse(localStorage.getItem('api-config') || '{}');
    recognition.lang = speechConfig.lang || 'zh-CN';

    recognition.onstart = () => {
      btnVoice.classList.add('listening');
      chatInput.placeholder = 'Listening...';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      chatInput.value = transcript;
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      btnVoice.classList.remove('listening');
      chatInput.placeholder = 'Ask about this page...';
      recognition = null;
    };

    recognition.onend = () => {
      btnVoice.classList.remove('listening');
      chatInput.placeholder = 'Ask about this page...';
      recognition = null;
    };

    recognition.start();
  }

  // ── Persona ──
  function loadPersona() {
    try {
      const saved = localStorage.getItem('study-workspace-persona');
      if (saved) {
        currentPersona = JSON.parse(saved);
        personaName.textContent = '🤖 ' + currentPersona.name;
      }
    } catch (e) { /* ignore */ }
  }

  // ── History ──
  async function toggleHistory() {
    if (historyDrawer.classList.contains('hidden')) {
      historyDrawer.classList.remove('hidden');
      await loadHistory();
    } else {
      historyDrawer.classList.add('hidden');
    }
  }

  async function loadHistory() {
    const subject = historySubjectFilter.value;
    const logs = await questionLogger.query({ subject, limit: 50 });

    if (logs.length === 0) {
      historyList.innerHTML = '<p class="empty-msg">No questions yet. Start studying!</p>';
      return;
    }

    historyList.innerHTML = logs.map(log => `
      <div class="history-item">
        <div class="q-label">${new Date(log.timestamp).toLocaleString()} · ${log.subject || 'unknown'}</div>
        <div class="q-text">${escapeHtml(log.question)}</div>
        <div class="a-text">${escapeHtml(log.response.substring(0, 200))}${log.response.length > 200 ? '...' : ''}</div>
        <div class="meta">${log.visionUsed ? '👁️ Vision' : ''} · ${log.persona || ''}</div>
      </div>
    `).join('');
  }

  async function exportHistory() {
    const json = await questionLogger.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `question-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── UI Helpers ──
  function addMessage(role, text, isThinking = false) {
    const div = document.createElement('div');
    div.className = `msg ${role}${isThinking ? ' thinking' : ''}`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'msg ai';
    div.style.background = '#e8f5e9';
    div.style.fontSize = '13px';
    div.textContent = '📋 ' + text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Start ──
  init();
})();
