# 模考界面 - 待办清单

## ✅ 已完成

- ~~Action 1: 克隆仓库并初始化 Web 项目框架~~ ✅
- ~~Action 2: 创建 Mock 测试数据模板（AP Calculus BC 2019）~~ ✅

## 🔄 进行中

- Action 3: 模考界面核心功能
  - ~~启动画面（Full/MCQ/FRQ 选择）~~ ✅
  - ~~题目展示 + LaTeX 渲染~~ ✅
  - ~~选项渲染（A/B/C/D）~~ ✅
  - ~~下一题/上一题 题号跳转~~ ✅
  - ~~Flag for Review~~ ✅
  - ~~计时器~~ ✅
  - ~~题号网格导航~~ ✅
  - ~~键盘快捷键（方向键 + 1-4）~~ ✅

## ⏳ 待办

- Action 4: 创建 `00_Cloud_Brain_Rules.md` 行动纲领
- 本地预览服务器测试（打开 index.html 验证）
- FRQ 模式布局（题目在左，答题区在右）
- 高亮功能实现
- Scratchpad 草稿板功能
- 多模块支持（Part A → Part B 切换）
- Review 页面（汇总所有题目状态）

## 技术选型

- **前端**：原生 HTML + CSS + JS（无需框架）
- **LaTeX 渲染**：KaTeX（CDN）
- **数据格式**：JSON（遵循 `ap-calculus-bc-2019-intl` 模板）
