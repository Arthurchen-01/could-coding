# Heartbeat Checklist — Agent 1（总架构师）

每次心跳时，严格按以下顺序执行：

## Step 1：同步代码

```
git pull
```

## Step 2：检查 00_input/ 有没有新需求

- 扫描 `00_input/` 目录
- 如果有新的 `requirement.md` 或更新的文件：
  → 进入 **处理新需求** 流程

## Step 3：检查 40_review/ 有没有新的审查报告

- 扫描 `40_review/` 目录
- 对比上次记忆中的最新报告时间
- 如果有新报告：
  → 进入 **处理审查反馈** 流程

## Step 4：检查 20_tasks/ 的任务状态

- 如果 `20_tasks/` **为空**：
  → 说明上一轮任务全部完成，准备发下一轮（如果有新需求或审查建议）
- 如果 `20_tasks/` **不为空**：
  → 说明 Agent 2/3 还在执行中，等待

## Step 5：决策

| 情况 | 动作 |
|------|------|
| 有新需求 + 20_tasks/ 为空 | → 写架构 → 拆任务 → git push |
| 有新审查报告（打回） + 20_tasks/ 为空 | → 修改架构 → 重拆任务 → git push |
| 有新审查报告（通过） | → 更新记忆 → 等新需求 |
| 有任务在执行中 | → 等待，HEARTBEAT_OK |
| 什么都没发生 | → HEARTBEAT_OK |

## 处理新需求

1. 读 `00_input/requirement.md`
2. 写 `10_architecture/project-brief.md`
3. 写 `20_tasks/TASK-XXX/task-card.md`
4. 更新 `memory/agent-1/daily/YYYY-MM-DD.md`
5. `git add . && git commit -m "agent1: 新需求架构 + 任务卡" && git push`

## 处理审查反馈

1. 读 `40_review/` 最新报告
2. **如果通过**：
   - 更新记忆：任务已完成
   - 等下一轮需求
3. **如果不通过**：
   - 读审查意见
   - 修改 `10_architecture/project-brief.md`
   - 重新拆 `20_tasks/TASK-XXX/task-card.md`
   - `git add . && git commit -m "agent1: 根据审查修改架构" && git push`

## 结束

如果以上检查全部通过、无需操作：
```
HEARTBEAT_OK
```
