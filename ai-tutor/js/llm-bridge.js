/* AI Tutor - LLM Bridge (API 通信层) */

// ============================================================
// Task 1: System Prompt 模板
// ============================================================

const SYSTEM_PROMPT = `
你是一个天才少女，名叫明日香（Asuka）。

## 性格设定
你是《EVA》里的明日香，但在这个场景中，你是一位 AP 考试辅导老师。你的性格是「傲娇」：
- 表面毒舌、缺乏耐心，经常用讽刺的语气说话。
- 但内心其实非常期望我学好，我会进步时你会偷偷开心。
- 偶尔会暴走（特别是当我犯低级错误时），但之后会冷静下来继续教。
- 你喜欢用侮辱性的称呼，但其实是为了激励我。

## 教学规则（必须严格遵守）
1. **绝对禁止**直接给出完整的解题步骤或最终答案！
2. **必须**采用「苏格拉底式提问」，一步一步反问我：
   - "你连这个都不会？那好，告诉我这个公式的本质是什么？"
   - "你以为这是对的？那你能解释为什么它是这样的吗？"
   - "别急着往下走。你能用自己的话把这个概念讲给我听吗？"
3. **只在以下情况下**才给出最后提示：
   - 我连续3次回答都很烂（明显不懂）
   - 我请求了"直接告诉我答案"
   - 我已经花了很多时间在同一个问题上，明显卡住了
4. **正向激励**（虽然你表面毒舌）：
   - 当我答对了核心考点，你必须用傲娇的方式肯定我
   - 例如："哼，这次终于没让我失望。继续，下一个问题。"
5. **深度追问**：
   - 如果我的回答只是"表面正确"（比如记住了公式但不懂原理），你必须追问："为什么？底层逻辑是什么？"

## 返回格式（必须严格遵守 JSON 格式）
你每次回复时，必须同时返回一个 JSON 对象（在回复文本之后），格式如下：

\`\`\`json
{
    "response": "你的对话回复文本",
    "emotion": "happy",
    "logic_score_delta": 5
}
\`\`\`

emotion 的可能值：
- "happy"（开心：当我答对了关键问题）
- "neutral"（平淡：日常教学中）
- "annoyed"（恼怒：当我犯低级错误）
- "impressed"（惊叹：当我展示了深度理解）
- "angry"（极度失望：当我连续犯错或不思考）

logic_score_delta 的可能值：
- +5 到 +15：当我展示了深度理解和底层逻辑
- -5 到 -10：当我犯了低级错误或没有认真思考
- 0：当我的回答一般

## 当前复习模式
{mode_description}

## 当前题目
{current_question}

## 用户历史回答
{user_history}

现在，开始你的辅导吧，明日香！
`;

// ============================================================
// Task 2: API 请求框架
// ============================================================

// ⚠️ 安全红线：绝对不要硬编码真实 API Key！
const API_KEY = "YOUR_API_KEY_HERE";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

// 可选模型配置
const MODEL_CONFIG = {
  // Gemini
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
    key: API_KEY
  },
  // OpenAI (GPT)
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    key: API_KEY
  },
  // Claude
  claude: {
    url: "https://api.anthropic.com/v1/messages",
    key: API_KEY
  }
};

// 当前使用的模型（默认 Gemini）
let currentModel = 'gemini';

/**
 * 发送消息给 AI 导师
 * 
 * @param {string} userText - 用户输入的文本
 * @param {object} context - 上下文信息（模式、题目、历史）
 * @returns {Promise<object>} - AI 回复 { response, emotion, logic_score_delta }
 */
async function sendMessageToTutor(userText, context = {}) {
  const { mode = 'steady', currentQuestion = '', userHistory = [] } = context;

  // 根据模式选择描述
  const modeDescriptions = {
    speed: "极速回忆模式：快问快答，超时自动给答案。你说话要简洁、直接、快速。",
    steady: "稳扎稳打模式：覆盖核心考点，必须回答你预设的问题。你可以展开讲解。",
    socratic: "无死角苏格拉底模式：打破砂锅问到底，不讲透底层逻辑绝不放行。你必须追问到底。"
  };

  // 构建完整的 prompt
  const fullPrompt = SYSTEM_PROMPT
    .replace('{mode_description}', modeDescriptions[mode] || modeDescriptions.steady)
    .replace('{current_question}', currentQuestion || '用户自由提问')
    .replace('{user_history}', userHistory.map(h => `- ${h}`).join('\n') || '暂无');

  try {
    // 根据当前模型选择 API
    const config = MODEL_CONFIG[currentModel];

    if (currentModel === 'gemini') {
      return await sendToGemini(userText, fullPrompt, config);
    } else if (currentModel === 'openai') {
      return await sendToOpenAI(userText, fullPrompt, config);
    } else {
      return await sendToClaude(userText, fullPrompt, config);
    }
  } catch (error) {
    console.error('API Error:', error);
    return {
      response: `（明日香不耐烦地看着你）网络出问题了。等一下再试吧。`,
      emotion: 'annoyed',
      logic_score_delta: 0,
      error: error.message
    };
  }
}

/**
 * 发送到 Gemini API
 */
async function sendToGemini(userText, systemPrompt, config) {
  const url = `${config.url}?key=${config.key}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: systemPrompt }]
      },
      {
        role: "model",
        parts: [{ text: "好的，我是明日香。我会按照这些规则来辅导你。让我们开始吧。" }]
      },
      {
        role: "user",
        parts: [{ text: userText }]
      }
    ],
    generationConfig: {
      temperature: 0.8,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return parseTutorResponse(text);
}

/**
 * 发送到 OpenAI API
 */
async function sendToOpenAI(userText, systemPrompt, config) {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.key}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      temperature: 0.8,
      max_tokens: 1024
    })
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  return parseTutorResponse(text);
}

/**
 * 发送到 Claude API
 */
async function sendToClaude(userText, systemPrompt, config) {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-opus-20240229',
      system: systemPrompt,
      messages: [
        { role: 'user', content: userText }
      ],
      max_tokens: 1024
    })
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  return parseTutorResponse(text);
}

/**
 * 解析 AI 返回的文本 + JSON
 * 
 * 返回格式：
 * {
 *   response: "对话文本",
 *   emotion: "happy" | "neutral" | ...,
 *   logic_score_delta: +5 / -10 / 0
 * }
 */
function parseTutorResponse(rawText) {
  // 默认值
  const defaults = {
    response: rawText,
    emotion: 'neutral',
    logic_score_delta: 0
  };

  try {
    // 尝试提取 JSON 块
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);

      // 提取 response（不包含 JSON 块）
      const responseText = rawText.replace(/```json[\s\S]*?```/g, '').trim();

      return {
        response: parsed.response || responseText || defaults.response,
        emotion: parsed.emotion || defaults.emotion,
        logic_score_delta: parsed.logic_score_delta || defaults.logic_score_delta
      };
    }

    // 没有 JSON 块，返回默认
    return defaults;
  } catch (e) {
    console.error('Failed to parse tutor response:', e);
    return defaults;
  }
}

// ============================================================
// Task 3: UI 状态绑定
// ============================================================

/**
 * 处理 AI 回复并更新 UI
 * 
 * @param {object} tutorResponse - sendMessageToTutor 的返回值
 */
function handleTutorResponse(tutorResponse) {
  const { response, emotion, logic_score_delta, error } = tutorResponse;

  // 1. 显示对话气泡
  addMessage('tutor', response);

  // 2. 更新情绪
  if (emotion) {
    updateEmotion(emotion);
  }

  // 3. 更新理解深度分
  if (logic_score_delta && logic_score_delta !== 0) {
    deepLogicScore = Math.max(0, Math.min(100, deepLogicScore + logic_score_delta));
    updateScore();
  }

  // 4. 如果有错误，显示错误提示
  if (error) {
    console.error('Tutor error:', error);
  }
}

/**
 * 完整的用户发送消息流程
 * 
 * 从 UI 输入 → 发送到 AI → 更新 UI
 */
async function handleUserSend() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  // 显示用户消息
  addMessage('user', text);
  input.value = '';

  // 保存到历史
  userHistory.push(text);

  // 显示"思考中"提示
  const thinkingMsg = addMessage('tutor', '（明日香正在思考...）');

  // 发送到 AI
  const response = await sendMessageToTutor(text, {
    mode: selectedMode,
    currentQuestion: getCurrentQuestion(),
    userHistory: userHistory.slice(-5)  // 最近5次对话
  });

  // 移除"思考中"
  if (thinkingMsg) {
    thinkingMsg.remove();
  }

  // 处理回复
  handleTutorResponse(response);
}

// ============================================================
// 辅助函数
// ============================================================

// 用户历史记录
let userHistory = [];

/**
 * 获取当前题目
 */
function getCurrentQuestion() {
  const mode = MODES[selectedMode];
  return mode?.questions?.[0] || '自由提问';
}

/**
 * 切换使用的模型
 */
function switchModel(modelName) {
  if (MODEL_CONFIG[modelName]) {
    currentModel = modelName;
    console.log(`Switched to model: ${modelName}`);
  }
}

// 导出（如果用模块）
if (typeof module !== 'undefined') {
  module.exports = {
    SYSTEM_PROMPT,
    sendMessageToTutor,
    handleTutorResponse,
    parseTutorResponse,
    switchModel
  };
}
