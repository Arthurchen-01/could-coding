# 全局流程规则

## 核心原则
- 仓库是唯一真相源
- 任何关键协作都必须落成文件
- 不允许通过口头上下文替代文件状态

## 流程顺序
1. 用户（或 Agent 1 收到飞书指令）写入 `00_input/`
2. Agent 1 写 `10_architecture/` 和 `20_tasks/`
3. Agent 2 写 `30_execution/`（含 HANDOFF.md）
4. Agent 3 写 `40_review/`（通过则删 task）
5. Agent 1 根据 review 决定下一轮

## 状态流转
`NEW -> ARCHITECTED -> EXECUTING -> REVIEWING -> DONE`
必要时可进入 `BLOCKED` 或 `ITERATING`

## 写入边界
- 用户：原始需求（`00_input/`）
- Agent 1：架构与任务（`10_architecture/` + `20_tasks/`）
- Agent 2：执行产物（`30_execution/`）
- Agent 3：审查报告（`40_review/`），通过则删 `20_tasks/`

## Git 规则
- 每个 Agent 操作前必须 `git pull`
- 每个 Agent 操作后必须 `git add . && git commit && git push`
- commit message 格式：`agentX: 简述`
