/* AP Exam Practice - Core Logic */

// ========== State ==========
let examData = null;
let currentIndex = 0;
let answers = {};       // { questionId: "A" | "B" | "C" | "D" }
let flags = {};         // { questionId: true/false }
let timerInterval = null;
let timeRemaining = 0;  // seconds
let timerEnabled = true;

// ========== Init ==========
document.addEventListener('DOMContentLoaded', async () => {
  // Load mock data
  await loadExamData();
  
  // Bind start screen events
  bindStartEvents();
});

async function loadExamData() {
  try {
    // Try loading from mock data directory
    const response = await fetch('../mock-data/ap-calculus-bc-sample.json');
    if (!response.ok) {
      // Fallback: load from same directory
      const fallback = await fetch('/mock-data/ap-calculus-bc-sample.json');
      examData = await fallback.json();
    } else {
      examData = await response.json();
    }
    
    // Update start screen
    document.getElementById('exam-title').textContent = examData.subject || 'AP Practice';
    document.getElementById('exam-subtitle').textContent = 
      `${examData.section || 'Practice'} — ${examData.year || '2019'}`;
    
  } catch (e) {
    console.error('Failed to load exam data:', e);
    // Use embedded fallback
    examData = getFallbackData();
  }
}

function getFallbackData() {
  return {
    examId: 'fallback',
    subject: 'AP Calculus BC',
    year: 2019,
    section: 'Section I',
    part: 'A',
    calculatorAllowed: false,
    totalQuestions: 5,
    timeLimitMinutes: 60,
    questions: [
      {
        id: 1, type: 'mcq', sectionPart: 'A', calculatorAllowed: false,
        question: 'If $f(x) = \\int_{0}^{x} (t^2 + 1)\\,dt$, then $f\'(2) =$',
        options: [
          { id: 'A', text: '3' },
          { id: 'B', text: '5' },
          { id: 'C', text: '$\\frac{8}{3}$' },
          { id: 'D', text: '$2\\sqrt{5}$' }
        ],
        correctAnswer: 'B',
        explanation: 'By FTC: $f\'(x) = x^2 + 1$, so $f\'(2) = 5$.',
        topics: ['Fundamental Theorem of Calculus']
      }
    ]
  };
}

// ========== Start Screen ==========
function bindStartEvents() {
  // Test type selection
  document.querySelectorAll('.start-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.start-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
  
  // Timer toggle
  const timerToggle = document.getElementById('timer-toggle');
  timerToggle.addEventListener('change', () => {
    timerEnabled = timerToggle.checked;
    document.getElementById('timer-label').textContent = timerEnabled ? 'On' : 'Off';
  });
  
  // Start button
  document.getElementById('start-btn').addEventListener('click', startExam);
}

function startExam() {
  if (!examData) return;
  
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('exam-screen').style.display = 'block';
  
  // Set time
  timeRemaining = (examData.timeLimitMinutes || 60) * 60;
  
  // Update section label
  document.getElementById('section-label').textContent = examData.subject;
  document.getElementById('part-label').textContent = 
    `Section ${examData.section.split(' - ')[0]} · Part ${examData.part}`;
  
  // Render navigator grid
  renderNavGrid();
  
  // Render first question
  renderQuestion(0);
  
  // Start timer
  if (timerEnabled) {
    startTimer();
  }
  
  // Bind navigation events
  bindNavEvents();
}

// ========== Timer ==========
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      alert('Time is up!');
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const el = document.getElementById('timer-display');
  el.textContent = display;
  
  // Urgent style when < 5 min
  if (timeRemaining < 300) {
    el.classList.add('urgent');
  } else {
    el.classList.remove('urgent');
  }
}

// ========== Question Rendering ==========
function renderQuestion(index) {
  if (!examData || !examData.questions || index >= examData.questions.length) return;
  
  const q = examData.questions[index];
  currentIndex = index;
  
  // Update question number
  document.getElementById('q-current').textContent = index + 1;
  document.getElementById('q-total').textContent = examData.questions.length;
  
  // Update question text (render LaTeX)
  const qText = document.getElementById('question-text');
  qText.innerHTML = '';
  
  // Render LaTeX in question text
  try {
    renderLatex(q.question, qText);
  } catch (e) {
    qText.textContent = q.question;
  }
  
  // Render options
  renderOptions(q);
  
  // Update flag button
  const flagBtn = document.getElementById('flag-btn');
  if (flags[q.id]) {
    flagBtn.classList.add('active');
    flagBtn.textContent = '⚑ Flagged';
  } else {
    flagBtn.classList.remove('active');
    flagBtn.textContent = '⚑ Flag for Review';
  }
  
  // Update nav buttons
  document.getElementById('prev-btn').disabled = index === 0;
  document.getElementById('next-btn').disabled = index === examData.questions.length - 1;
  document.getElementById('next-btn').textContent = 
    index === examData.questions.length - 1 ? 'Finish' : 'Next →';
  
  // Update nav grid
  updateNavGrid();
}

function renderOptions(question) {
  const container = document.getElementById('options-container');
  container.innerHTML = '';
  
  question.options.forEach(opt => {
    const div = document.createElement('div');
    div.className = 'option';
    if (answers[question.id] === opt.id) {
      div.classList.add('selected');
    }
    
    div.innerHTML = `
      <div class="option-letter">${opt.id}</div>
      <div class="option-text"></div>
    `;
    
    // Render LaTeX in option text
    const optText = div.querySelector('.option-text');
    try {
      renderLatex(opt.text, optText);
    } catch (e) {
      optText.textContent = opt.text;
    }
    
    // Click to select
    div.addEventListener('click', () => {
      answers[question.id] = opt.id;
      
      // Update UI
      container.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
      div.classList.add('selected');
      
      // Update nav grid
      updateNavGrid();
    });
    
    container.appendChild(div);
  });
}

// ========== LaTeX Rendering ==========
function renderLatex(text, element) {
  // Split by $ for inline LaTeX
  const parts = text.split(/(\$[^$]+\$)/g);
  
  parts.forEach(part => {
    if (part.startsWith('$') && part.endsWith('$')) {
      // LaTeX formula
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
      // Plain text
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
    if (answers[q.id]) cell.classList.add('answered');
    if (flags[q.id]) cell.classList.add('flagged');
    
    cell.addEventListener('click', () => {
      renderQuestion(idx);
    });
    
    grid.appendChild(cell);
  });
}

function updateNavGrid() {
  const cells = document.querySelectorAll('.nav-cell');
  cells.forEach((cell, idx) => {
    cell.classList.remove('current', 'answered', 'flagged');
    
    const q = examData.questions[idx];
    if (idx === currentIndex) cell.classList.add('current');
    if (answers[q.id]) cell.classList.add('answered');
    if (flags[q.id]) cell.classList.add('flagged');
  });
}

// ========== Navigation Events ==========
function bindNavEvents() {
  // Previous button
  document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentIndex > 0) {
      renderQuestion(currentIndex - 1);
    }
  });
  
  // Next button
  document.getElementById('next-btn').addEventListener('click', () => {
    if (currentIndex < examData.questions.length - 1) {
      renderQuestion(currentIndex + 1);
    } else {
      // Last question - show finish dialog
      if (confirm('Are you sure you want to finish this section?')) {
        clearInterval(timerInterval);
        showResults();
      }
    }
  });
  
  // Flag button
  document.getElementById('flag-btn').addEventListener('click', () => {
    const q = examData.questions[currentIndex];
    flags[q.id] = !flags[q.id];
    
    const btn = document.getElementById('flag-btn');
    if (flags[q.id]) {
      btn.classList.add('active');
      btn.textContent = '⚑ Flagged';
    } else {
      btn.classList.remove('active');
      btn.textContent = '⚑ Flag for Review';
    }
    
    updateNavGrid();
  });
  
  // Directions button
  document.getElementById('directions-btn').addEventListener('click', () => {
    document.getElementById('directions-modal').classList.add('active');
  });
}

// ========== Results ==========
function showResults() {
  const total = examData.questions.length;
  let correct = 0;
  
  examData.questions.forEach(q => {
    if (answers[q.id] === q.correctAnswer) {
      correct++;
    }
  });
  
  const score = Math.round((correct / total) * 100);
  
  alert(
    `🎉 Section Complete!\n\n` +
    `Score: ${correct}/${total} (${score}%)\n` +
    `Time remaining: ${document.getElementById('timer-display').textContent}\n\n` +
    `Correct answers will be shown next.`
  );
  
  // Show correct answers
  document.querySelectorAll('.option').forEach(opt => {
    opt.classList.remove('selected');
  });
  
  examData.questions.forEach(q => {
    if (answers[q.id] === q.correctAnswer) {
      // Mark correct
      const cells = document.querySelectorAll('.nav-cell');
      cells.forEach((cell, idx) => {
        if (examData.questions[idx].id === q.id) {
          cell.style.background = '#dcfce7';
          cell.style.borderColor = '#22c55e';
        }
      });
    }
  });
}

// ========== Utilities ==========
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ========== Keyboard Shortcuts ==========
document.addEventListener('keydown', (e) => {
  if (!examData) return;
  
  // Arrow keys for navigation
  if (e.key === 'ArrowRight' && currentIndex < examData.questions.length - 1) {
    renderQuestion(currentIndex + 1);
  } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
    renderQuestion(currentIndex - 1);
  }
  
  // 1-4 keys for options
  if (['1', '2', '3', '4'].includes(e.key)) {
    const idx = parseInt(e.key) - 1;
    const q = examData.questions[currentIndex];
    if (q && q.options[idx]) {
      answers[q.id] = q.options[idx].id;
      renderQuestion(currentIndex);  // Re-render
    }
  }
  
  // F for flag
  if (e.key === 'f' || e.key === 'F') {
    document.getElementById('flag-btn').click();
  }
});
