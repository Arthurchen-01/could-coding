# AP Practice Website 🎓

> 自用 AP 练习站 · 八科齐发 · 五分冲刺

**线上地址：** https://arthurchen-01.github.io/could-coding/

---

## 🔥 三步点火指南

### 第一步：打开首页

在浏览器打开：
```
https://arthurchen-01.github.io/could-coding/index.html
```

你会看到六个模块卡片：模考、Dashboard、训练、伴读、AI导师、设置。

### 第二步：配置 API Key

1. 点击右上角 **⚙️** 齿轮按钮
2. 填入 3 个东西：
   - **Base URL**：填 `https://api.openai.com/v1`（OpenAI）或留空（Gemini）
   - **API Key**：填你的 Key（`sk-...` 或 `AIzaSy...`）
   - **Model ID**：填 `gpt-4o` 或 `gemini-pro`
3. 点击 **💾 保存配置**
4. （可选）点击底部的快捷预设按钮（🟢 Gemini / 🔵 OpenAI）自动填写

### 第三步：开始使用

- **模考**：点击"套题模考" → 选 Full-Length → Resume → 做题
- **伴读**：点击"多模态伴读" → 上传图片 → 点"👀 让导师看这页" → 开始对话
- **AI导师**：点击"AI导师" → 选模式 → 开始苏格拉底式对话
- **Dashboard**：点击"Dashboard" → 看八科数据 + 错题列表

---

## 📁 项目结构

```
could-coding/
├── index.html              ← 首页（你打开的入口）
├── exam/                   ← 套题模考（Bluebook 界面）
├── dashboard/v2/           ← Dashboard（错题本 + AI分析）
├── training/               ← 专项训练（漏斗式筛选）
├── study-hub/              ← 多模态伴读学习舱
├── ai-tutor/               ← AI 导师（明日香）
├── components/             ← 共享组件
│   ├── global-nav.js/css   ← 全局导航
│   └── settings-modal.*    ← 设置弹窗
├── js/                     ← 共享服务
│   ├── api-config.js       ← API 配置管理
│   └── data-service.js     ← 数据加载服务
├── data/                   ← 考试 JSON 数据
├── mock-data/              ← Mock 数据
└── scripts/                ← 数据处理脚本
```

---

## 🔑 API 配置说明

| 模型 | Base URL | Model ID |
|------|----------|----------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| Gemini | （留空） | `gemini-pro` |
| Claude | `https://api.anthropic.com/v1` | `claude-3-5-sonnet-20240620` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |

**支持中转站代理**：把 Base URL 填成你的代理地址即可。

---

## 📊 当前功能状态

| 模块 | 功能 | 状态 |
|------|------|------|
| 模考 | MCQ/FRQ/KaTeX/高亮/计时器/题号导航 | ✅ |
| Dashboard | 科目卡片/掌握度/错题列表/AI分析 | ✅ |
| 训练 | 科目→题型→策略→开始 | ✅ |
| 伴读 | 上传图片/AI阅读/苏格拉底出题 | ✅ |
| AI导师 | 明日香聊天/三种模式/情绪系统 | ✅ |
| 全局 | 导航/状态保持/配置中心 | ✅ |

---

## 🛠️ 技术栈

- 前端：原生 HTML/CSS/JS
- LaTeX：KaTeX
- AI：OpenAI/Gemini/Claude 多模态 API
- 数据：JSON
- 部署：GitHub Pages
- 存储：localStorage

---

## ⚠️ 已知限制

1. **公式占位符**：旧版 MathType 数据标记为 `[⚠️公式待接入]`，等待 MinerU 纯净输出
2. **PDF 上传**：当前仅支持图片，PDF 需截图
3. **语音/图片按钮**：UI 占位，待后端支持
4. **做题进度**：保存在 localStorage，清浏览器数据会丢失

---

**由 OpenClaw Agent 构建 · 2026-03-28**
