# AP-Learning-Web → could-coding 数据整合方案

## 目标
把 AP-Learning-Web 的题目数据导入 could-coding，补齐缺失科目。

## 数据格式对照

### AP-Learning-Web 格式
```json
{
  "data": {
    "examName": "AP 物理C电磁 2025年样题1",
    "subjectName": "物理C电磁",
    "totalQuestion": 44,
    "questionList": [{
      "questionType": 0,  // 0=MCQ, 1=FRQ
      "questionTitle": "题目标题",
      "choiceQuestionContent": "<div>HTML内容...</div>",
      "optionList": ["A", "B", "C", "D"],
      "questionAnswer": "A",
      "analysis": "解析..."
    }]
  }
}
```

### could-coding 格式
```json
{
  "examId": "physics-c-em-2025",
  "subject": "physics-c-em",
  "examName": "AP 物理C电磁 2025年样题1",
  "year": "2025",
  "totalQuestions": 44,
  "mcqCount": 35,
  "frqCount": 9,
  "questions": [{
    "id": 1,
    "type": "mcq",
    "question": "纯文本题目",
    "title": "简短标题",
    "options": [{"id": "A", "text": "..."}],
    "correctAnswer": "A",
    "unit": ""
  }]
}
```

## 可用数据清单

| 科目 | AP-Learning-Web | could-coding已有 | 缺口 |
|------|----------------|-----------------|------|
| 物理C电磁 | 2025样题1/2/3 ✅ | ❌ 无 | 🔴 补齐 |
| 统计 | 2017/2018/2019/2021国际卷 ✅ | ❌ 无 | 🔴 补齐 |
| 宏观经济 | 2023国际卷+样题1/2/3 ✅ | ❌ 无 | 🔴 补齐 |
| 微积分BC | 2017/2018/2021国际卷(有MathType) ⚠️ | 2019/2021 | 🟡 补充 |
| 微观经济 | 2017/2018/2019/2021国际卷 ✅ | 2018 | 🟡 补充 |
| 心理学 | 2025样题1/2/3 ✅ | ❌ 无 | 🔴 补齐 |
| 物理C力学 | 2025样题1/2/3 ✅ | ❌ 无 | 🔴 补齐 |
| CSA | 2020/2021/拼题1/2 ✅ | ❌ 无 | 🟡 补充 |

## 执行步骤

1. ✅ 梳理数据结构差异
2. 🔄 编写转换脚本（HTML→文本，格式对齐）
3. 下载 AP-Learning-Web 数据
4. 转换并生成 could-coding 格式 JSON
5. 按 data-service.js 的命名规则放入 data/ 目录
6. 测试加载
7. 推送 GitHub

## 注意事项
- MathType 污染：微积分BC 旧数据使用 `[⚠️公式待接入]` 占位
- 2025年样题（物理/心理）格式干净，可直接转换
- 图片链接指向 learnosity CDN，可能需要处理
