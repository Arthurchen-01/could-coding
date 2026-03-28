/* Targeted Practice - Core Logic */

// ========== State ==========
let currentStep = 1;
let selection = {
  subject: null,
  type: null,
  strategy: null
};

// ========== Subjects ==========
const SUBJECTS = [
  { id: 'calc-bc', name: 'Calculus BC', date: '2026-05-06' },
  { id: 'physics-c-mech', name: 'Physics C Mechanics', date: '2026-05-12' },
  { id: 'physics-c-em', name: 'Physics C E&M', date: '2026-05-12' },
  { id: 'csa', name: 'Computer Science A', date: '2026-05-05' },
  { id: 'statistics', name: 'Statistics', date: '2026-05-06' },
  { id: 'macroeconomics', name: 'Macroeconomics', date: '2026-05-09' },
  { id: 'microeconomics', name: 'Microeconomics', date: '2026-05-09' },
  { id: 'psychology', name: 'Psychology', date: '2026-05-11' }
];

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  renderSubjectGrid();
  bindEvents();
});

// ========== Render ==========
function renderSubjectGrid() {
  const grid = document.getElementById('subject-grid');
  grid.innerHTML = '';

  SUBJECTS.forEach(subj => {
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.dataset.id = subj.id;

    // Days to exam
    const today = new Date();
    const examDate = new Date(subj.date);
    const daysLeft = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));

    card.innerHTML = `
      <div class="card-name">${subj.name}</div>
      <div class="card-date">${daysLeft > 0 ? `${daysLeft} 天后` : '已考'}</div>
    `;

    card.addEventListener('click', () => {
      // Deselect all
      grid.querySelectorAll('.subject-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selection.subject = subj;
    });

    grid.appendChild(card);
  });
}

// ========== Events ==========
function bindEvents() {
  // Type buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selection.type = btn.dataset.type;
    });
  });

  // Strategy buttons
  document.querySelectorAll('.strategy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.strategy-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selection.strategy = btn.dataset.strategy;
    });
  });

  // Navigation
  document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  document.getElementById('next-btn').addEventListener('click', () => {
    if (validateStep(currentStep)) {
      goToStep(currentStep + 1);
    }
  });

  // Start button
  document.getElementById('start-btn').addEventListener('click', startPractice);

  // Restart button
  document.getElementById('restart-btn').addEventListener('click', () => {
    selection = { subject: null, type: null, strategy: null };
    goToStep(1);
  });
}

// ========== Navigation ==========
function goToStep(step) {
  // Update current
  currentStep = step;

  // Hide all panels
  document.querySelectorAll('.step-panel').forEach(p => p.classList.add('hidden'));

  // Show current
  document.getElementById(`step-${step}`).classList.remove('hidden');

  // Update step indicators
  document.querySelectorAll('.step').forEach(s => {
    const sStep = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (sStep === step) s.classList.add('active');
    else if (sStep < step) s.classList.add('completed');
  });

  // Update nav buttons
  document.getElementById('prev-btn').disabled = step === 1;
  
  const nextBtn = document.getElementById('next-btn');
  if (step === 4) {
    nextBtn.style.display = 'none';
  } else {
    nextBtn.style.display = 'block';
  }

  // If on step 4, populate summary
  if (step === 4) populateSummary();
}

function validateStep(step) {
  switch (step) {
    case 1:
      if (!selection.subject) {
        alert('请先选择一个科目');
        return false;
      }
      return true;
    case 2:
      if (!selection.type) {
        alert('请先选择题型');
        return false;
      }
      return true;
    case 3:
      if (!selection.strategy) {
        alert('请先选择训练策略');
        return false;
      }
      return true;
    default:
      return true;
  }
}

function populateSummary() {
  const typeLabels = { mcq: 'MCQ (选择题)', frq: 'FRQ (简答题)' };
  const strategyLabels = { basic: '🎯 基础知识点巩固', advanced: '🔥 深度综合实战' };

  document.getElementById('summary-subject').textContent = selection.subject?.name || '—';
  document.getElementById('summary-type').textContent = typeLabels[selection.type] || '—';
  document.getElementById('summary-strategy').textContent = strategyLabels[selection.strategy] || '—';
}

// ========== Start Practice ==========
function startPractice() {
  // Store selection in localStorage for exam page to pick up
  localStorage.setItem('trainingConfig', JSON.stringify(selection));

  // Redirect to exam page
  // In a real app, this would filter questions based on selection
  // For now, just redirect to the exam
  window.location.href = '../exam/index.html';
}
