/* Data Service - 统一数据入口层 */

// ============================================================
// 数据路径配置
// ============================================================

const DATA_PATHS = {
  // 真实题库路径
  real: '../data/',
  // Mock 数据路径
  mock: '../mock-data/',
  // Dashboard 数据
  dashboard: '../mock-data/dashboard-data.json'
};

// ============================================================
// Subject ID → 文件名映射
// ============================================================

const SUBJECT_FILE_MAP = {
  'calc-bc': 'ap-calculus-bc',
  'calc-ab': 'ap-calculus-ab',
  'physics-c-mech': 'ap-physics-c-mechanics',
  'physics-c-em': 'ap-physics-c-em',
  'physics-1': 'ap-physics-1',
  'physics-2': 'ap-physics-2',
  'csa': 'ap-computer-science-a',
  'statistics': 'ap-statistics',
  'macroeconomics': 'ap-macroeconomics',
  'microeconomics': 'ap-microeconomics',
  'psychology': 'ap-psychology',
  'biology': 'ap-biology',
  'chemistry': 'ap-chemistry',
  'english-lang': 'ap-english-language',
  'english-lit': 'ap-english-literature',
  'world-history': 'ap-world-history',
  'us-history': 'ap-us-history',
  'human-geography': 'ap-human-geography'
};

// ============================================================
// 缓存
// ============================================================

const dataCache = new Map();

// ============================================================
// 核心函数：获取考试数据
// ============================================================

/**
 * 获取考试数据
 * 
 * @param {string} subjectId - 科目 ID（如 'calc-bc'）
 * @param {string} year - 年份（如 '2019'）
 * @returns {Promise<object>} - 考试数据对象
 */
async function fetchExamData(subjectId, year = null) {
  const fileName = SUBJECT_FILE_MAP[subjectId] || subjectId;
  const cacheKey = `${fileName}-${year || 'sample'}`;

  // 检查缓存
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  let data = null;
  let source = 'unknown';

  // 尝试路径列表（按优先级）
  const tryPaths = [];

  if (year) {
    // 如果指定了年份，先尝试真实数据
    tryPaths.push({
      path: `${DATA_PATHS.real}${fileName}-${year}.json`,
      type: 'real'
    });
    // 再尝试 mock
    tryPaths.push({
      path: `${DATA_PATHS.mock}${fileName}-${year}.json`,
      type: 'mock'
    });
  }

  // 总是尝试 sample 数据作为最后回退
  tryPaths.push({
    path: `${DATA_PATHS.mock}${fileName}-sample.json`,
    type: 'sample'
  });

  // 通用 mock 数据（最后保底）
  tryPaths.push({
    path: `${DATA_PATHS.mock}ap-calculus-bc-sample.json`,
    type: 'fallback'
  });

  for (const { path, type } of tryPaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        data = await response.json();
        source = type;
        break;
      }
    } catch (e) {
      // 路径不存在，继续尝试下一个
      continue;
    }
  }

  if (!data) {
    // 使用内置 fallback
    data = getBuiltinFallback(subjectId);
    source = 'builtin';
  }

  // 如果使用的是 mock/fallback，显示提示
  if (source !== 'real') {
    showDataFallbackNotice(subjectId, source);
  }

  // 缓存结果
  dataCache.set(cacheKey, { ...data, _source: source });

  return { ...data, _source: source };
}

/**
 * 获取 Dashboard 数据
 */
async function fetchDashboardData() {
  const cacheKey = 'dashboard';

  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  try {
    const response = await fetch(DATA_PATHS.dashboard);
    if (response.ok) {
      const data = await response.json();
      dataCache.set(cacheKey, data);
      return data;
    }
  } catch (e) {
    // Fallback
  }

  // 内置 fallback
  return getBuiltinDashboardFallback();
}

/**
 * 获取科目列表（用于下拉菜单等）
 */
function getSubjectList() {
  return Object.entries(SUBJECT_FILE_MAP).map(([id, name]) => ({
    id,
    name: name.replace('ap-', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }));
}

/**
 * 清除缓存
 */
function clearDataCache() {
  dataCache.clear();
}

/**
 * 获取缓存状态
 */
function getCacheStatus() {
  return {
    size: dataCache.size,
    keys: Array.from(dataCache.keys())
  };
}

// ============================================================
// Fallback 通知
// ============================================================

/**
 * 显示数据降级提示
 */
function showDataFallbackNotice(subjectId, source) {
  const messages = {
    real: '',
    mock: `⚠️ 未检测到 ${subjectId} 的真实题库，已加载演示数据`,
    sample: `📋 使用 ${subjectId} 的示例数据`,
    fallback: `🔄 使用默认演示数据（${subjectId} 的专属数据尚未上传）`,
    builtin: `📥 使用内置 fallback 数据`
  };

  const msg = messages[source];
  if (!msg) return;

  // 显示 toast 提示
  showToast(msg, source === 'mock' ? 'warning' : 'info');

  console.log(`[Data Service] ${msg}`);
}

/**
 * Toast 通知
 */
function showToast(message, type = 'info') {
  // 检查是否已有 toast 容器
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 500;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    animation: slideInRight 0.3s ease;
    max-width: 320px;
  `;

  if (type === 'warning') {
    toast.style.background = '#fef3c7';
    toast.style.color = '#92400e';
    toast.style.border = '1px solid #fbbf24';
  } else {
    toast.style.background = '#dbeafe';
    toast.style.color = '#1e40af';
    toast.style.border = '1px solid #3b82f6';
  }

  toast.textContent = message;
  container.appendChild(toast);

  // 3秒后自动消失
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);

  // 添加动画样式
  if (!document.getElementById('toast-animation-style')) {
    const style = document.createElement('style');
    style.id = 'toast-animation-style';
    style.textContent = `
      @keyframes slideInRight {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }
}

// ============================================================
// 内置 Fallback 数据
// ============================================================

function getBuiltinFallback(subjectId) {
  return {
    examId: `${subjectId}-builtin-fallback`,
    subject: subjectId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    year: 2024,
    section: 'Section I',
    part: 'A',
    calculatorAllowed: false,
    totalQuestions: 3,
    timeLimitMinutes: 60,
    questions: [
      {
        id: 1, type: 'mcq', sectionPart: 'A', calculatorAllowed: false,
        question: 'Sample Question 1 — This is fallback data.',
        options: [
          { id: 'A', text: 'Option A' },
          { id: 'B', text: 'Option B' },
          { id: 'C', text: 'Option C' },
          { id: 'D', text: 'Option D' }
        ],
        correctAnswer: 'A',
        explanation: 'This is a sample fallback question.',
        topics: ['Sample']
      },
      {
        id: 2, type: 'mcq', sectionPart: 'A', calculatorAllowed: false,
        question: 'Sample Question 2 — This is fallback data.',
        options: [
          { id: 'A', text: 'Option A' },
          { id: 'B', text: 'Option B' },
          { id: 'C', text: 'Option C' },
          { id: 'D', text: 'Option D' }
        ],
        correctAnswer: 'B',
        explanation: 'This is a sample fallback question.',
        topics: ['Sample']
      },
      {
        id: 3, type: 'frq', sectionPart: 'B', calculatorAllowed: true,
        totalPoints: 9,
        question: 'Sample FRQ — This is fallback data.',
        context: 'This is a sample free response question.',
        parts: [
          { id: 'a', points: 3, question: 'Part (a): Solve this.' },
          { id: 'b', points: 3, question: 'Part (b): Explain this.' },
          { id: 'c', points: 3, question: 'Part (c): Prove this.' }
        ],
        topics: ['Sample']
      }
    ]
  };
}

function getBuiltinDashboardFallback() {
  return {
    user: {
      name: 'Arthur Chen',
      avatar: 'OC',
      goal: 'AP 2026',
      bio: '自学 AP 考生'
    },
    exams: [
      {
        id: 'calc-bc',
        name: 'Calculus BC',
        examDate: '2026-05-06',
        predictedScore: 4,
        fiveProbability: 70,
        mcqScore: 35,
        mcqTotal: 45,
        frqScore: 40,
        frqTotal: 54,
        units: [
          { id: 1, name: 'Sample Unit', mastery: 60, crown: false }
        ]
      }
    ]
  };
}

// ============================================================
// 导出
// ============================================================

if (typeof module !== 'undefined') {
  module.exports = {
    fetchExamData,
    fetchDashboardData,
    getSubjectList,
    clearDataCache,
    getCacheStatus,
    SUBJECT_FILE_MAP
  };
}
