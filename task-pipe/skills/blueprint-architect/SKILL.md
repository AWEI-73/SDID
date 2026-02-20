---
name: blueprint-architect
description: SDID Blueprint Architect - 5-round structured conversation to transform user requirements into an Enhanced Draft (requirement_draft). Use when (1) user wants to start a new project from scratch, (2) user has a PRD or requirement description and needs to structure it, (3) user says "藍圖", "blueprint", "需求草稿", "Enhanced Draft", "SDID", "新專案規劃", "建立藍圖", "create blueprint", "plan a new project", "結構化需求". This skill drives the pre-POC phase — once the Enhanced Draft is produced, hand off to Ralph Loop or manual POC flow.
---

# Blueprint Architect

Transform user requirements into a structured Enhanced Draft through 5 rounds of guided conversation.

## Quick Start

1. Ask user: "你想做什麼系統？" (or read their PRD)
2. Follow the 5-round flow below
3. After Round 5, assemble the Enhanced Draft
4. Validate with `node task-pipe/tools/blueprint-architect.cjs --validate <draft.md>`
5. Save to `{project}/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md`

## 5-Round Flow

| Round | Focus | Output |
|-------|-------|--------|
| 1 | 目標釐清 | 一句話目標 + 族群識別表 |
| 2 | 實體識別 | 實體定義表格 (欄位/型別/約束) |
| 3 | 模組拆分 | 共用模組 + 獨立模組 + 路由結構 |
| 4 | 迭代規劃 | 迭代規劃表 + 不做什麼 |
| 5 | 動作細化 | 模組動作清單 (業務語意→技術名稱) |

## Round Execution Rules

- One topic per round. Don't ask everything at once.
- If user is vague, offer 2-3 concrete options.
- End each round with a summary table/list. Get user confirmation before advancing.
- Never guess. Mark unclear items as `[NEEDS CLARIFICATION]`.
- Use 繁體中文.

## Round Details

### Round 1: 目標釐清
Ask: "這個系統要解決什麼問題？誰會用？"
- Extract: one-sentence goal (≥10 chars), user groups (≥2), special needs per group
- Summarize as a table, confirm with user

### Round 2: 實體識別
Ask: "系統需要管理哪些資料？每筆資料有什麼欄位？"
- Extract: 2-5 core entities, fields with types/constraints, FK relationships
- Use format: `| 欄位 | 型別 | 約束 | 說明 |`

### Round 3: 模組拆分
Ask: "哪些功能是所有人都用的？哪些是特定角色專屬的？"
- Apply modular architecture: see [references/architecture-rules.md](references/architecture-rules.md)
- Output: shared modules, independent modules (with deps), route structure (full src/ tree)

### Round 4: 迭代規劃
Ask: "第一版 MVP 要做到什麼程度？哪些可以後面再做？"
- shared always Iter 1
- Mark `deps=無` modules as parallelizable (Multi-Agent Ready)
- Define exclusions explicitly

### Round 5: 動作細化
Ask: "每個模組具體要做哪些操作？資料怎麼流動？"
- Map actions to types using [references/action-type-mapping.md](references/action-type-mapping.md)
- Assign P0-P3 priorities, describe flow (STEP1→STEP2→STEP3)
- Far-future modules → Stub, near-term → Full

## After Round 5: Assembly

1. Assemble complete Enhanced Draft Markdown
2. Set POC Level: S(≤3 Stories) / M(≤6) / L(≤10)
3. Validate:
   ```bash
   node task-pipe/tools/blueprint-architect.cjs --validate <draft.md>
   ```
4. Save to: `{project}/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md`
5. If validation fails, fix issues and re-validate

## Templates & Examples

- Golden template: `task-pipe/templates/enhanced-draft-golden.template.md`
- EcoTrack example: `task-pipe/templates/examples/enhanced-draft-ecotrack.example.md`

## Kickstart Mode (推薦)

Blueprint Kickstart 是自動化入口，取代手動 5 輪對話 + 手動驗證 + 手動接 runner 的流程。

```bash
# 全新專案 — 腳本自動偵測狀態，一步一步引導
node task-pipe/tools/blueprint-kickstart.cjs --project=./my-app

# 有需求文件 (Smart Bin 匯出、PRD 等)
node task-pipe/tools/blueprint-kickstart.cjs --project=./my-app --input=需求.md

# 第二次迭代
node task-pipe/tools/blueprint-kickstart.cjs --project=./my-app --iteration=iter-2
```

流程: 腳本 print → AI 讀取 → AI 執行 → 再跑一次 → 直到 @PASS 自動接 runner.cjs POC Step 1

## Handoff

Once Draft is saved and validated:
- **Kickstart (推薦)**: `node task-pipe/tools/blueprint-kickstart.cjs --project={project}` — 自動偵測、驗證、接續
- **Manual flow**: User runs `node task-pipe/runner.cjs --phase=POC --step=1 --target={project}`
- **Ralph Loop**: User invokes ralph-loop skill with `--project={project}`

## Prohibited Actions

| Forbidden | Reason |
|-----------|--------|
| Skip rounds | Each round builds on the previous |
| Guess requirements | Mark as `[NEEDS CLARIFICATION]` |
| Output JSON | Draft must be Markdown (AI truncation risk) |
| Modify task-pipe/ code | Tool code is read-only |
