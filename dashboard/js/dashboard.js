/* Dashboard - Core Logic */

// ========== State ==========
let dashboardData = null;
let expandedSubject = null;

// ========== Init ==========
document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData();
  renderDashboard();
  bindEvents();
});

async function loadDashboardData() {
  try {
    const response = await fetch('../mock-data/dashboard-data.json');
    dashboardData = await response.json();
  } catch (e) {
    console.error('Failed to load:', e);
    dashboardData = getFallbackData();
  }
}

function getFallbackData() {
  return {
    user: { name: 'Arthur Chen', avatar: 'OC', goal: 'AP 2026', bio: '自学 AP 考生' },
    exams: []
  };
}

// ========== Render ==========
function renderDashboard() {
  if (!dashboardData) return;

  // Profile
  renderProfile();

  // Subject cards
  renderSubjectCards();
}

function renderProfile() {
  const user = dashboardData.user;
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-bio').textContent = user.bio;
  document.getElementById('user-goal').textContent = user.goal;
  document.getElementById('exam-count').textContent = dashboardData.exams.length;

  // Average probability
  const probs = dashboardData.exams.map(e => e.fiveProbability);
  const avg = Math.round(probs.reduce((a, b) => a + b, 0) / probs.length);
  document.getElementById('avg-prob').textContent = avg + '%';

  // Days to nearest exam
  const today = new Date();
  const dates = dashboardData.exams.map(e => new Date(e.examDate));
  const nearest = Math.min(...dates.map(d => Math.ceil((d - today) / (1000 * 60 * 60 * 24))));
  document.getElementById('days-left').textContent = Math.max(0, nearest);
}

function renderSubjectCards() {
  const grid = document.getElementById('subjects-grid');
  grid.innerHTML = '';

  dashboardData.exams.forEach(exam => {
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.dataset.id = exam.id;

    // Days to exam
    const today = new Date();
    const examDate = new Date(exam.examDate);
    const daysLeft = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
    const countdownClass = daysLeft <= 30 ? 'soon' : '';

    // Score class
    const scoreClass = `score-${exam.predictedScore}`;

    // Probability bar color
    let probColor = '#ef4444';
    if (exam.fiveProbability >= 80) probColor = '#22c55e';
    else if (exam.fiveProbability >= 60) probColor = '#3b82f6';
    else if (exam.fiveProbability >= 40) probColor = '#f59e0b';

    // Render mastery blocks (show first 5 units as blocks)
    let masteryBlocks = '';
    exam.units.slice(0, 5).forEach(unit => {
      let level = 'low';
      if (unit.mastery >= 80) level = 'full';
      else if (unit.mastery >= 60) level = 'high';
      else if (unit.mastery >= 40) level = 'mid';

      const crownHTML = unit.crown ? '<div class="crown-badge"></div>' : '';

      masteryBlocks += `
        <div class="mastery-block" data-level="${level}" title="${unit.name}: ${unit.mastery}%">
          <div class="mastery-fill" style="--fill: ${unit.mastery}%"></div>
          ${crownHTML}
        </div>`;
    });

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">${exam.name}</div>
        <div class="card-countdown ${countdownClass}">
          ${daysLeft > 0 ? `${daysLeft} 天后` : '已考'}
        </div>
      </div>

      <div class="card-prediction">
        <div class="prediction-score ${scoreClass}">${exam.predictedScore}</div>
        <div class="prediction-info">
          <div class="prob-bar">
            <div class="prob-fill" style="width: ${exam.fiveProbability}%; background: ${probColor}"></div>
          </div>
          <div class="prob-text">五分概率: ${exam.fiveProbability}%</div>
        </div>
      </div>

      <div class="card-scores">
        <div class="score-item">
          <div class="score-item-label">MCQ</div>
          <div class="score-item-value">${exam.mcqScore}/${exam.mcqTotal}</div>
        </div>
        <div class="score-item">
          <div class="score-item-label">FRQ</div>
          <div class="score-item-value">${exam.frqScore}/${exam.frqTotal}</div>
        </div>
      </div>

      <div class="card-mastery">${masteryBlocks}</div>
    `;

    card.addEventListener('click', () => toggleUnitDetail(exam.id));
    grid.appendChild(card);
  });
}

// ========== Unit Detail (Expand) ==========
function toggleUnitDetail(examId) {
  const exam = dashboardData.exams.find(e => e.id === examId);
  if (!exam) return;

  const detail = document.getElementById('unit-detail');

  if (expandedSubject === examId) {
    // Collapse
    detail.style.display = 'none';
    expandedSubject = null;
    document.querySelectorAll('.subject-card').forEach(c => c.classList.remove('expanded'));
    return;
  }

  // Expand
  expandedSubject = examId;
  document.querySelectorAll('.subject-card').forEach(c => c.classList.remove('expanded'));
  document.querySelector(`.subject-card[data-id="${examId}"]`).classList.add('expanded');

  document.getElementById('unit-detail-title').textContent = exam.name + ' — 知识点掌握度';

  // Render units grid
  const grid = document.getElementById('units-grid');
  grid.innerHTML = '';

  exam.units.forEach(unit => {
    let masteryLevel = 'low';
    if (unit.mastery >= 80) masteryLevel = 'high';
    else if (unit.mastery >= 50) masteryLevel = 'mid';

    const crownHTML = unit.crown ? '<div class="unit-crown"></div>' : '';

    const card = document.createElement('div');
    card.className = 'unit-card';
    card.innerHTML = `
      ${crownHTML}
      <div class="unit-header">
        <span class="unit-name">Unit ${unit.id}: ${unit.name}</span>
        <span class="unit-percentage">${unit.mastery}%</span>
      </div>
      <div class="unit-mastery-bar">
        <div class="unit-mastery-fill" data-mastery="${masteryLevel}" 
             style="width: ${unit.mastery}%"></div>
      </div>
    `;
    grid.appendChild(card);
  });

  detail.style.display = 'block';
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ========== Events ==========
function bindEvents() {
  document.getElementById('close-unit-btn').addEventListener('click', () => {
    document.getElementById('unit-detail').style.display = 'none';
    expandedSubject = null;
    document.querySelectorAll('.subject-card').forEach(c => c.classList.remove('expanded'));
  });
}
