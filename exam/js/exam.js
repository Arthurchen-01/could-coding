/* AP Exam Practice - Core Logic */

// ========== State ==========
let examData = null;
let currentIndex = 0;
let answers = {};       // { questionId: "A" } for MCQ, { "q6a": "text..." } for FRQ
let flags = {};         // { questionId: true/false }
let highlights = [];    // [{ text, range, questionId }]
let timerInterval = null;
let timeRemaining = 0;
let timerEnabled = true;
let highlightMode = false;

// ========== Exam Catalog ==========
const EXAM_CATALOG = [
  { id: 'calc-bc', year: '2019', name: 'Calculus BC', label: '微积分BC — 2019' },
  { id: 'physics-c-em', year: '2025', name: 'Physics C: E&M', label: '物理C电磁 — 2025样题' },
  { id: 'physics-c-mech', year: '2025', name: 'Physics C: Mechanics', label: '物理C力学 — 2025样题' },
  { id: 'statistics', year: '2021', name: 'Statistics', label: '统计 — 2021国际卷' },
  { id: 'macroeconomics', year: '2023', name: 'Macroeconomics', label: '宏观经济 — 2023' },
  { id: 'microeconomics', year: '2021', name: 'Microeconomics', label: '微观经济 — 2021' },
  { id: 'psychology', year: '2025', name: 'Psychology', label: '心理学 — 2025样题' },
  { id: 'csa', year: '2020', name: 'Computer Science A', label: '计算机A — 2020' },
];

// ========== Init ==========
document.addEventListener('DOMContentLoaded', async () => {
  populateExamSelector();
  await loadExamData();
  bindStartEvents();
});

function populateExamSelector() {
  const sel = document.getElementById('exam-selector');
  if (!sel) return;
  sel.innerHTML = '';
  EXAM_CATALOG.forEach((ex, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = ex.label;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', async () => {
    const idx = parseInt(sel.value);
    if (!isNaN(idx)) {
      const ex = EXAM_CATALOG[idx];
      await loadExamData(ex.id, ex.year, ex.name);
    }
  });
}

async function loadExamData(subjectId, year, displayName) {
  subjectId = subjectId || 'calc-bc';
  year = year || '2019';
  displayName = displayName || 'Calculus BC';
  try {
    // 使用数据服务层（自动降级）
    examData = await fetchExamData(subjectId, year);
    
    if (examData._source && examData._source !== 'real') {
      console.log(`[Exam] Data source: ${examData._source}`);
    }
    
    document.getElementById('exam-title').textContent = examData.examName || `AP ${displayName}`;
    document.getElementById('exam-subtitle').textContent = 
      `${examData.totalQuestions || '?'} 题 — ${examData.year || year}`;
  } catch (e) {
    console.error('Failed to load:', e);
    examData = getBuiltinFallback(subjectId);
  }
}

function getFallbackData() {
  return {
    examId: 'fallback', subject: 'AP Calculus BC', year: 2019,
    section: 'Section I', part: 'A', calculatorAllowed: false,
    totalQuestions: 1, timeLimitMinutes: 60,
    questions: [{
      id: 1, type: 'mcq', sectionPart: 'A', calculatorAllowed: false,
      question: 'If $f(x) = \\int_{0}^{x} (t^2 + 1)\\,dt$, then $f\'(2) =$',
      options: [{ id: 'A', text: '3' }, { id: 'B', text: '5' }],
      correctAnswer: 'B', explanation: 'By FTC', topics: ['FTC']
    }]
  };
}

// ========== Start Screen ==========
function bindStartEvents() {
  document.querySelectorAll('.start-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.start-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
  
  document.getElementById('timer-toggle').addEventListener('change', (e) => {
    timerEnabled = e.target.checked;
    document.getElementById('timer-label').textContent = timerEnabled ? 'On' : 'Off';
  });
  
  document.getElementById('start-btn').addEventListener('click', startExam);
}

function startExam() {
  if (!examData) return;
  
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('exam-screen').style.display = 'block';
  
  timeRemaining = (examData.timeLimitMinutes || 60) * 60;
  document.getElementById('section-label').textContent = examData.subject;
  document.getElementById('part-label').textContent = 
    `Section ${examData.section.split(' - ')[0]} · Part ${examData.part}`;
  
  renderNavGrid();
  renderQuestion(0);
  
  if (timerEnabled) startTimer();
  bindNavEvents();
  bindHighlightEvents();
}

// ========== Timer ==========
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    if (timeRemaining <= 0) { clearInterval(timerInterval); alert('Time is up!'); }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const el = document.getElementById('timer-display');
  el.textContent = display;
  el.classList.toggle('urgent', timeRemaining < 300);
}

// ========== Question Rendering ==========
function renderQuestion(index) {
  if (!examData || !examData.questions || index >= examData.questions.length) return;
  
  const q = examData.questions[index];
  currentIndex = index;
  
  document.getElementById('q-current').textContent = index + 1;
  document.getElementById('q-total').textContent = examData.questions.length;
  
  // Render based on type
  if (q.type === 'frq') {
    renderFRQ(q);
  } else {
    renderMCQ(q);
  }
  
  // Update flag button
  updateFlagButton(q.id);
  
  // Update nav buttons
  document.getElementById('prev-btn').disabled = index === 0;
  const nextBtn = document.getElementById('next-btn');
  nextBtn.disabled = index === examData.questions.length - 1;
  nextBtn.textContent = index === examData.questions.length - 1 ? 'Finish' : 'Next →';
  
  updateNavGrid();
}

function renderMCQ(q) {
  const qPanel = document.querySelector('.question-panel');
  qPanel.style.display = 'block';
  
  // Hide FRQ layout
  const frqLayout = document.getElementById('frq-layout');
  if (frqLayout) frqLayout.style.display = 'none';
  
  // Show MCQ layout
  qPanel.style.display = 'block';
  
  const qText = document.getElementById('question-text');
  qText.innerHTML = '';
  renderLatex(q.question, qText);
  
  // Render options
  const container = document.getElementById('options-container');
  container.innerHTML = '';
  
  q.options.forEach(opt => {
    const div = document.createElement('div');
    div.className = 'option';
    if (answers[q.id] === opt.id) div.classList.add('selected');
    
    div.innerHTML = `<div class="option-letter">${opt.id}</div><div class="option-text"></div>`;
    renderLatex(opt.text, div.querySelector('.option-text'));
    
    div.addEventListener('click', () => {
      answers[q.id] = opt.id;
      container.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
      div.classList.add('selected');
      updateNavGrid();
    });
    
    container.appendChild(div);
  });
}

function renderFRQ(q) {
  // Hide MCQ elements
  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';
  
  const qText = document.getElementById('question-text');
  
  // Create FRQ layout
  let frqLayout = document.getElementById('frq-layout');
  if (!frqLayout) {
    frqLayout = document.createElement('div');
    frqLayout.id = 'frq-layout';
    frqLayout.className = 'frq-layout';
    qText.parentElement.appendChild(frqLayout);
  }
  frqLayout.style.display = 'grid';
  
  // Build left side (question + parts)
  let leftHTML = `<div class="frq-question">
    <div class="frq-context" id="frq-context"></div>`;
  
  if (q.parts && q.parts.length > 0) {
    leftHTML += `<div class="frq-parts">`;
    q.parts.forEach(part => {
      leftHTML += `
        <div class="frq-part" id="frq-part-${part.id}">
          <div class="frq-part-header">
            <div class="frq-part-label">${part.id}</div>
            <span class="frq-part-points">(${part.points} points)</span>
          </div>
          <div class="frq-part-question" id="frq-question-${part.id}"></div>
        </div>`;
    });
    leftHTML += `</div>`;
  }
  leftHTML += `</div>`;
  
  // Build right side (answer area)
  let rightHTML = `<div class="frq-answer">
    <div class="frq-answer-label">Your Response</div>`;
  
  if (q.parts && q.parts.length > 0) {
    q.parts.forEach(part => {
      rightHTML += `
        <div style="margin-bottom:20px">
          <div class="frq-answer-label">Part (${part.id}) (${part.points} points)</div>
          <textarea id="frq-answer-${part.id}" 
                    data-part="${part.id}" 
                    data-question-id="${q.id}"
                    placeholder="Write your answer for part (${part.id}) here...">${answers[`${q.id}-${part.id}`] || ''}</textarea>
        </div>`;
    });
  } else {
    rightHTML += `<textarea id="frq-answer-main" 
                    data-question-id="${q.id}"
                    placeholder="Write your answer here...">${answers[q.id] || ''}</textarea>`;
  }
  rightHTML += `</div>`;
  
  frqLayout.innerHTML = leftHTML + rightHTML;
  
  // Render LaTeX in context
  const contextEl = document.getElementById('frq-context');
  if (q.context) {
    renderLatex(q.context, contextEl);
  } else {
    contextEl.style.display = 'none';
  }
  
  // Render LaTeX in question
  const mainQ = document.getElementById('question-text');
  mainQ.innerHTML = '';
  renderLatex(q.question, mainQ);
  
  // Render LaTeX in each part
  if (q.parts) {
    q.parts.forEach(part => {
      const partEl = document.getElementById(`frq-question-${part.id}`);
      if (partEl) {
        renderLatex(part.question, partEl);
      }
    });
  }
  
  // Bind answer input
  document.querySelectorAll('.frq-answer textarea').forEach(textarea => {
    textarea.addEventListener('input', (e) => {
      const part = e.target.dataset.part;
      const qId = e.target.dataset.questionId;
      if (part) {
        answers[`${qId}-${part}`] = e.target.value;
      } else {
        answers[qId] = e.target.value;
      }
      updateNavGrid();
    });
  });
  
  // Hide MCQ question text (FRQ uses its own layout)
  qText.style.display = 'none';
  
  // Show timer for FRQ too
  updateTimerDisplay();
}

// ========== LaTeX Rendering ==========
function renderLatex(text, element) {
  if (!text) return;
  
  const parts = text.split(/(\$[^$]+\$)/g);
  parts.forEach(part => {
    if (part.startsWith('$') && part.endsWith('$')) {
      const latex = part.slice(1, -1);
      try {
        const span = document.createElement('span');
        katex.render(latex, span, { throwOnError: false });
        element.appendChild(span);
      } catch (e) {
        const span = document.createElement('span');
        span.textContent = part;
        span.style.color = 'red';
        element.appendChild(span);
      }
    } else {
      const span = document.createElement('span');
      span.textContent = part;
      element.appendChild(span);
    }
  });
}

// ========== Question Navigator ==========
function renderNavGrid() {
  const grid = document.getElementById('nav-grid');
  grid.innerHTML = '';
  if (!examData) return;
  
  examData.questions.forEach((q, idx) => {
    const cell = document.createElement('div');
    cell.className = 'nav-cell';
    cell.textContent = idx + 1;
    cell.dataset.index = idx;
    
    if (idx === currentIndex) cell.classList.add('current');
    if (hasAnswer(q)) cell.classList.add('answered');
    if (flags[q.id]) cell.classList.add('flagged');
    
    cell.addEventListener('click', () => {
      // Show MCQ question text when switching
      document.getElementById('question-text').style.display = 'block';
      renderQuestion(idx);
    });
    
    grid.appendChild(cell);
  });
}

function hasAnswer(q) {
  if (q.type === 'mcq') return !!answers[q.id];
  if (q.type === 'frq' && q.parts) {
    return q.parts.some(p => answers[`${q.id}-${p.id}`]?.length > 0);
  }
  return !!answers[q.id];
}

function updateNavGrid() {
  const cells = document.querySelectorAll('.nav-cell');
  cells.forEach((cell, idx) => {
    cell.classList.remove('current', 'answered', 'flagged');
    const q = examData.questions[idx];
    if (idx === currentIndex) cell.classList.add('current');
    if (hasAnswer(q)) cell.classList.add('answered');
    if (flags[q.id]) cell.classList.add('flagged');
  });
}

// ========== Navigation ==========
function bindNavEvents() {
  document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentIndex > 0) {
      document.getElementById('question-text').style.display = 'block';
      renderQuestion(currentIndex - 1);
    }
  });
  
  document.getElementById('next-btn').addEventListener('click', () => {
    if (currentIndex < examData.questions.length - 1) {
      document.getElementById('question-text').style.display = 'block';
      renderQuestion(currentIndex + 1);
    } else {
      if (confirm('Are you sure you want to finish?')) {
        clearInterval(timerInterval);
        showResults();
      }
    }
  });
  
  document.getElementById('flag-btn').addEventListener('click', () => {
    const q = examData.questions[currentIndex];
    flags[q.id] = !flags[q.id];
    updateFlagButton(q.id);
    updateNavGrid();
  });
  
  document.getElementById('directions-btn').addEventListener('click', () => {
    document.getElementById('directions-modal').classList.add('active');
  });
}

function updateFlagButton(qId) {
  const btn = document.getElementById('flag-btn');
  if (flags[qId]) {
    btn.classList.add('active');
    btn.textContent = '⚑ Flagged';
  } else {
    btn.classList.remove('active');
    btn.textContent = '⚑ Flag for Review';
  }
}

// ========== Highlight Feature ==========
function bindHighlightEvents() {
  const highlightBtn = document.getElementById('highlight-btn');
  
  highlightBtn.addEventListener('click', () => {
    highlightMode = !highlightMode;
    highlightBtn.classList.toggle('active', highlightMode);
    highlightBtn.textContent = highlightMode ? '✏ Highlighting' : '✏ Highlight';
    
    document.querySelector('.question-panel').classList.toggle('highlight-mode', highlightMode);
    
    const frqLayout = document.getElementById('frq-layout');
    if (frqLayout) {
      frqLayout.querySelector('.frq-question').classList.toggle('highlight-mode', highlightMode);
    }
  });
  
  // Listen for text selection
  document.addEventListener('mouseup', () => {
    if (!highlightMode) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    if (!selectedText) return;
    
    // Don't highlight in textarea or input
    if (range.startContainer.parentElement.closest('textarea, input')) return;
    
    // Apply highlight
    try {
      const span = document.createElement('span');
      span.className = 'highlight-mark';
      
      // Check if selection is in a valid area
      const container = range.commonAncestorContainer.parentElement;
      if (container.closest('.question-text, .frq-context, .frq-part-question')) {
        range.surroundContents(span);
        
        highlights.push({
          text: selectedText,
          questionIndex: currentIndex,
          timestamp: Date.now()
        });
        
        // Clear selection
        selection.removeAllRanges();
      }
    } catch (e) {
      // Selection spans multiple elements - fallback: wrap each child
      const span = document.createElement('span');
      span.className = 'highlight-mark';
      span.textContent = selectedText;
      range.deleteContents();
      range.insertNode(span);
      selection.removeAllRanges();
    }
  });
}

// ========== Results ==========
function showResults() {
  const total = examData.questions.length;
  let correct = 0;
  let mcqCount = 0;
  
  examData.questions.forEach(q => {
    if (q.type === 'mcq') {
      mcqCount++;
      if (answers[q.id] === q.correctAnswer) correct++;
    }
  });
  
  const score = mcqCount > 0 ? Math.round((correct / mcqCount) * 100) : 0;
  
  alert(
    `🎉 Section Complete!\n\n` +
    `MCQ Score: ${correct}/${mcqCount} (${score}%)\n` +
    `Time remaining: ${document.getElementById('timer-display').textContent}\n\n` +
    `FRQ answers have been saved.`
  );
}

// ========== Utilities ==========
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ========== Keyboard Shortcuts ==========
document.addEventListener('keydown', (e) => {
  if (!examData) return;
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  
  if (e.key === 'ArrowRight' && currentIndex < examData.questions.length - 1) {
    document.getElementById('question-text').style.display = 'block';
    renderQuestion(currentIndex + 1);
  } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
    document.getElementById('question-text').style.display = 'block';
    renderQuestion(currentIndex - 1);
  }
  
  if (['1', '2', '3', '4'].includes(e.key) && examData.questions[currentIndex].type === 'mcq') {
    const idx = parseInt(e.key) - 1;
    const q = examData.questions[currentIndex];
    if (q && q.options[idx]) {
      answers[q.id] = q.options[idx].id;
      renderQuestion(currentIndex);
    }
  }
  
  if (e.key === 'f' || e.key === 'F') {
    document.getElementById('flag-btn').click();
  }
});
