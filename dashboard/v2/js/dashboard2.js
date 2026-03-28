/* Dashboard 2.0 - Core Logic */

// ========== State ==========
let currentExamData = null;
let aiModeEnabled = true;

// ========== Init ==========
document.addEventListener('DOMContentLoaded', async () => {
  await loadExamList();
  bindEvents();
});

// ========== Load Exam List ==========
async function loadExamList() {
  try {
    // 使用数据服务获取可用考试
    const response = await fetch('../data/');
    // Fallback: 直接用预设列表
    populateExamSelect();
  } catch (e) {
    populateExamSelect();
  }
}

function populateExamSelect() {
  const select = document.getElementById('exam-select');
  
  // 预设考试列表
  const exams = [
    { id: 'CSA__AP CSA 2021年国际卷__1902622418221764608', name: 'AP CSA 2021年国际卷' },
    { id: '微积分BC__AP 微积分BC 2017年国际卷__1902622411338911744', name: 'AP Calculus BC 2017' },
    { id: '微积分BC__AP 微积分BC 2018年国际卷__1902622411800285184', name: 'AP Calculus BC 2018' },
    { id: '微积分BC__AP 微积分BC 2019年国际卷__1902622412253270016', name: 'AP Calculus BC 2019' },
    { id: '统计学__AP 统计 2017年国际卷__1902622413180211200', name: 'AP Statistics 2017' },
    { id: '统计学__AP 统计 2018年国际卷__1902622413633196032', name: 'AP Statistics 2018' },
    { id: '微观经济__AP 微观经济 2017年国际卷__1902622410416164864', name: 'AP Microeconomics 2017' },
    { id: '微观经济__AP 微观经济 2018年国际卷__1902622410881732608', name: 'AP Microeconomics 2018' },
    { id: '心理__AP 心理 2025年样题1__1902622420520243200', name: 'AP Psychology 2025 Sample 1' },
    { id: '心理__AP 心理 2025年样题2__1902622420977422336', name: 'AP Psychology 2025 Sample 2' },
  ];
  
  select.innerHTML = '<option value="">选择考试...</option>';
  exams.forEach(exam => {
    const opt = document.createElement('option');
    opt.value = exam.id;
    opt.textContent = exam.name;
    select.appendChild(opt);
  });
}

// ========== Load Exam ==========
async function loadExam(examId) {
  if (!examId) return;
  
  try {
    // 尝试从 data 目录加载
    let data = null;
    try {
      const resp = await fetch(`../data/${examId}.json`);
      if (resp.ok) data = await resp.json();
    } catch (e) {}
    
    // 如果不存在，尝试处理 raw-json
    if (!data) {
      showToast('数据处理中，请稍候...', 'info');
      // 这里可以调用后端处理 API
      data = await fetchFromRawJson(examId);
    }
    
    if (data) {
      currentExamData = data;
      renderDashboard(data);
    } else {
      showToast('无法加载考试数据', 'warning');
    }
  } catch (e) {
    showToast('加载失败: ' + e.message, 'warning');
  }
}

async function fetchFromRawJson(examId) {
  // 简单 fallback: 返回 mock 数据
  return await fetchExamData('calc-bc', '2019');
}

// ========== Render ==========
function renderDashboard(data) {
  // Show all sections
  document.getElementById('exam-overview').style.display = 'block';
  document.getElementById('unit-accuracy').style.display = 'block';
  document.getElementById('wrong-list').style.display = 'block';
  
  // Overview stats
  document.getElementById('total-questions').textContent = data.totalQuestions || data.questions?.length || 0;
  document.getElementById('accuracy').textContent = (data.accuracy || 0) + '%';
  
  // Wrong answers
  const wrongQuestions = (data.questions || []).filter(q => 
    q.userCorrect === false || 
    (q.userAnswer && q.correctAnswer && String(q.userAnswer).trim() !== String(q.correctAnswer).trim())
  );
  
  document.getElementById('wrong-count').textContent = wrongQuestions.length;
  
  const answered = (data.questions || []).filter(q => q.userAnswer).length;
  document.getElementById('answer-rate').textContent = 
    Math.round(answered / (data.questions?.length || 1) * 100) + '%';
  
  // Unit accuracy bars
  renderUnitBars(data.units || []);
  
  // Wrong answer table
  renderWrongTable(wrongQuestions);
}

function renderUnitBars(units) {
  const container = document.getElementById('unit-bars');
  container.innerHTML = '';
  
  if (!units.length) {
    container.innerHTML = '<p style="color:var(--muted)">暂无 Unit 数据</p>';
    return;
  }
  
  units.forEach(unit => {
    const bar = document.createElement('div');
    bar.className = 'unit-bar';
    
    // Color based on accuracy
    let color = 'var(--red)';
    if (unit.accuracy >= 80) color = 'var(--green)';
    else if (unit.accuracy >= 60) color = 'var(--yellow)';
    else if (unit.accuracy >= 40) color = '#f97316';
    
    bar.innerHTML = `
      <div class="unit-name">${unit.name}</div>
      <div class="unit-bar-track">
        <div class="unit-bar-fill" style="width: ${unit.accuracy}%; background: ${color};">
          ${unit.accuracy >= 20 ? `<span class="unit-bar-text">${unit.accuracy}%</span>` : ''}
        </div>
      </div>
      <div class="unit-bar-stats">${unit.correct}/${unit.answered}</div>
    `;
    
    container.appendChild(bar);
  });
}

function renderWrongTable(wrongQuestions) {
  const tbody = document.getElementById('wrong-tbody');
  tbody.innerHTML = '';
  
  if (!wrongQuestions.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--muted)">🎉 暂无错题！</td></tr>';
    return;
  }
  
  wrongQuestions.forEach(q => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${q.id || q.sort || '?'}</td>
      <td>${q.title || q.questionText?.substring(0, 50) || '—'}</td>
      <td class="correct">${q.correctAnswer || '—'}</td>
      <td class="wrong">${q.userAnswer || '未作答'}</td>
      <td>${q.unit || '—'}</td>
      <td>
        <button class="ai-btn" data-question-id="${q.id}" ${!aiModeEnabled ? 'disabled' : ''}>
          🤖 AI Analysis
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Bind AI analysis buttons
  document.querySelectorAll('.ai-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!aiModeEnabled) return;
      const qId = btn.dataset.questionId;
      const question = wrongQuestions.find(q => String(q.id) === qId);
      if (question) showAIAnalysis(question);
    });
  });
}

// ========== AI Analysis ==========
async function showAIAnalysis(question) {
  const panel = document.getElementById('ai-panel');
  const content = document.getElementById('ai-panel-content');
  
  panel.style.display = 'block';
  content.innerHTML = '<div class="ai-loading">明日香正在分析中...</div>';
  
  // 构建 prompt
  const prompt = `
题目：${question.title || question.questionText || '未知题目'}
用户答案：${question.userAnswer || '未作答'}
正确答案：${question.correctAnswer || '未知'}
所属 Unit：${question.unit || '未知'}

请用苏格拉底式提问法分析这道错题。不要直接给答案，而是引导用户思考。
`;
  
  try {
    // 调用 AI 导师
    const response = await sendMessageToTutor(prompt, {
      mode: 'socratic',
      currentQuestion: question.questionText || '',
      userHistory: []
    });
    
    // 显示回复
    content.innerHTML = `
      <div style="margin-bottom:12px;">
        <strong>题目：</strong>${question.title || question.questionText?.substring(0, 100) || '—'}
      </div>
      <div style="margin-bottom:12px;">
        <strong>你的答案：</strong><span style="color:var(--red)">${question.userAnswer || '未作答'}</span>
        &nbsp;→&nbsp;
        <strong>正确答案：</strong><span style="color:var(--green)">${question.correctAnswer || '—'}</span>
      </div>
      <hr style="border:none; border-top:1px solid var(--line); margin:12px 0">
      <div><strong>👩‍🏫 明日香：</strong></div>
      <div style="margin-top:8px; line-height:1.8">${response.response || '（API Key 未配置，暂无分析）'}</div>
    `;
  } catch (e) {
    content.innerHTML = `
      <div style="color:var(--red)">API 调用失败: ${e.message}</div>
      <div style="margin-top:12px; color:var(--muted)">请检查 API Key 是否已配置。</div>
    `;
  }
}

// ========== Events ==========
function bindEvents() {
  // Load button
  document.getElementById('load-exam-btn').addEventListener('click', () => {
    const examId = document.getElementById('exam-select').value;
    if (examId) loadExam(examId);
  });
  
  // AI mode toggle
  document.getElementById('ai-mode-toggle').addEventListener('change', (e) => {
    aiModeEnabled = e.target.checked;
    document.querySelectorAll('.ai-btn').forEach(btn => {
      btn.disabled = !aiModeEnabled;
    });
  });
  
  // Close AI panel
  document.getElementById('close-ai-panel').addEventListener('click', () => {
    document.getElementById('ai-panel').style.display = 'none';
  });
}

// ========== Toast ==========
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed; top:80px; right:20px; z-index:9999;';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.style.cssText = `
    padding: 12px 20px; border-radius: 10px; font-size: 0.9rem;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin-bottom: 8px;
    background: ${type === 'warning' ? '#fef3c7' : '#dbeafe'};
    color: ${type === 'warning' ? '#92400e' : '#1e40af'};
    border: 1px solid ${type === 'warning' ? '#fbbf24' : '#3b82f6'};
  `;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}
