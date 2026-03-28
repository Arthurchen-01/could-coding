/* AI Tutor - Core Logic */

// ========== State ==========
let selectedMode = null;
let chatHistory = [];
let deepLogicScore = 0;

// ========== Tutor Profiles ==========
const TUTORS = {
  asuka: {
    name: '明日香',
    face: '👩‍🏫',
    role: '你的 AP 微积分导师',
    greeting: '哼，又来了？这次不会又是什么都不会吧？说说看，你想从哪里开始？',
    emotions: {
      happy: '😊 满意',
      neutral: '😐 中立',
      annoyed: '😤 恼怒',
      impressed: '😮 惊叹',
      angry: '😡 生气'
    }
  }
};

// ========== Mode Config ==========
const MODES = {
  speed: {
    name: '极速回忆',
    icon: '⚡',
    time: '10/20 分钟',
    greeting: '（明日香看了看表）好，快问快答模式。超时不答我就直接告诉你答案，别浪费时间！准备好了吗？',
    questions: [
      '∫x dx = ?',
      'sin\'(x) = ?',
      'e^x 的泰勒级数展开是什么？',
      '链式法则怎么用？',
      '什么是 L\'Hôpital 法则？'
    ]
  },
  steady: {
    name: '稳扎稳打',
    icon: '🧩',
    time: '30 分钟',
    greeting: '（明日香放下二郎腿）好，这次我不催你。但是每道题你必须回答我的预设问题，少一个都不行。来，说说什么是极限？',
    questions: [
      '请用你自己的话解释什么是极限？',
      '导数的几何意义是什么？',
      '如果 f\'(x) > 0，函数有什么特点？',
      '积分的基本思想是什么？',
      '举一个在实际生活中用到积分的例子。'
    ]
  },
  socratic: {
    name: '无死角苏格拉底',
    icon: '🌌',
    time: '不限时',
    greeting: '（明日香盯着你）苏格拉底模式开启。我会一直问，直到你讲透底层逻辑。说说看，你为什么要学微积分？它到底在解决什么问题？',
    questions: [
      '你为什么要学微积分？它到底在解决什么问题？',
      '变化率和导数的关系是什么？',
      '如果你是数学家，你会怎么发现积分？',
      '为什么 dx 可以无限小？这有意义吗？',
      '告诉我积分和导数互逆的直觉理由。'
    ]
  }
};

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  bindModeSelection();
  bindChatEvents();
  bindModalEvents();
});

// ========== Mode Selection ==========
function bindModeSelection() {
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedMode = card.dataset.mode;
      document.getElementById('start-tutor-btn').disabled = false;
    });
  });

  document.getElementById('start-tutor-btn').addEventListener('click', () => {
    if (selectedMode) startChat();
  });
}

// ========== Start Chat ==========
function startChat() {
  document.getElementById('mode-panel').style.display = 'none';
  document.getElementById('chat-interface').style.display = 'flex';

  const mode = MODES[selectedMode];
  const tutor = TUTORS.asuka;

  // Update header
  document.getElementById('tutor-name').textContent = tutor.name;
  document.getElementById('tutor-emotion').textContent = tutor.emotions.neutral;

  // Clear chat
  chatHistory = [];
  deepLogicScore = 0;
  updateScore();

  // Add greeting
  addMessage('tutor', mode.greeting);

  // Add first question after a delay
  setTimeout(() => {
    addMessage('tutor', mode.questions[0]);
  }, 1500);
}

// ========== Chat Events ==========
function bindChatEvents() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');

  sendBtn.addEventListener('click', handleUserSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleUserSend();
  });

  // Voice and image placeholders
  document.getElementById('voice-btn').addEventListener('click', () => {
    alert('🎤 语音输入功能正在开发中...');
  });

  document.getElementById('image-btn').addEventListener('click', () => {
    alert('🖼️ 图片上传功能正在开发中...');
  });
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  addMessage('user', text);
  input.value = '';

  // Simulate tutor response
  setTimeout(() => {
    const response = generateResponse(text);
    addMessage('tutor', response.text);
    updateEmotion(response.emotion);
    if (response.scoreGain) {
      deepLogicScore = Math.min(100, deepLogicScore + response.scoreGain);
      updateScore();
    }
  }, 800 + Math.random() * 1200);
}

function addMessage(sender, text) {
  chatHistory.push({ sender, text, time: new Date() });

  const history = document.getElementById('chat-history');
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;

  const tutor = TUTORS.asuka;
  const senderName = sender === 'tutor' ? tutor.name : '你';

  msgDiv.innerHTML = `
    <div class="message-sender">${senderName}</div>
    <div class="bubble">${text}</div>
  `;

  history.appendChild(msgDiv);
  history.scrollTop = history.scrollHeight;
}

// ========== Response Generation ==========
function generateResponse(userText) {
  const mode = MODES[selectedMode];
  const text = userText.toLowerCase();

  // Check for quality answers
  if (text.includes('因为') || text.includes('所以') || text.includes('原因') || text.includes('本质')) {
    return {
      text: '（明日香眼睛一亮）不错！你说到点子上了。继续往下讲，为什么是这样？',
      emotion: 'impressed',
      scoreGain: 5
    };
  }

  if (text.includes('不知道') || text.includes('不会') || text.includes('不懂')) {
    return {
      text: '（明日香叹了口气）这样啊...那我换个方式问你。你知道什么是函数吗？函数的变化率是什么？',
      emotion: 'annoyed',
      scoreGain: 0
    };
  }

  if (text.includes('积分') || text.includes('导数') || text.includes('极限')) {
    return {
      text: '对对对，你说的没错。那我问你，为什么积分和导数是互逆的？你能给我一个直觉上的解释吗？',
      emotion: 'neutral',
      scoreGain: 3
    };
  }

  if (text.includes('面积') || text.includes('变化')) {
    return {
      text: '（明日香点头）很好，你已经抓住了一半了。继续追问：为什么 "变化" 这个概念需要数学工具来描述？',
      emotion: 'happy',
      scoreGain: 4
    };
  }

  // Default responses
  const defaults = [
    { text: '（明日香歪头）这个回答...有意思。再说说？', emotion: 'neutral', scoreGain: 1 },
    { text: '嗯...你有没有想过更底层的原因？', emotion: 'neutral', scoreGain: 1 },
    { text: '（明日香微笑）你开始认真思考了呢。继续~', emotion: 'happy', scoreGain: 2 },
    { text: '还行。但你能用自己的话再说一遍吗？', emotion: 'neutral', scoreGain: 1 },
    { text: '（明日香掏出笔记本）来，画个图给我看。', emotion: 'neutral', scoreGain: 0 }
  ];

  return defaults[Math.floor(Math.random() * defaults.length)];
}

function updateEmotion(emotion) {
  const tutor = TUTORS.asuka;
  const el = document.getElementById('tutor-emotion');
  el.textContent = tutor.emotions[emotion] || tutor.emotions.neutral;

  // Update face emoji based on emotion
  const face = document.querySelector('.tutor-face');
  const emojiMap = {
    happy: '😊',
    neutral: '😐',
    annoyed: '😤',
    impressed: '😮',
    angry: '😡'
  };
  face.textContent = emojiMap[emotion] || '😐';
}

function updateScore() {
  document.getElementById('deep-logic-score').textContent = deepLogicScore;
  document.getElementById('score-fill').style.width = deepLogicScore + '%';
}

// ========== Modal Events ==========
function bindModalEvents() {
  document.getElementById('mode-switch-btn').addEventListener('click', () => {
    document.getElementById('mode-switch-modal').style.display = 'flex';
  });

  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('mode-switch-modal').style.display = 'none';
  });

  document.querySelectorAll('.mode-mini-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.mode-mini-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      selectedMode = card.dataset.mode;
      const mode = MODES[selectedMode];

      addMessage('tutor', `（明日香切换到${mode.icon} ${mode.name}模式）好，${mode.greeting}`);
      document.getElementById('mode-switch-modal').style.display = 'none';
    });
  });
}
