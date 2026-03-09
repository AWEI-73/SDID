# 📖 SDID 操作手冊 — 雙流程對照指南

**版本**: v1.3
**日期**: 2026-02-13
**語言**: 繁體中文

---

## 0. 兩條路線總覽

SDID 有兩條開發路線，根據你的情境選擇：

```
路線 A: Blueprint Flow (推薦)
  Gemini Gem 對話 → 活藍圖 → Gate → draft-to-plan → BUILD → Shrink → 下一個 iter

路線 B: Task-Pipe Flow (傳統)
  POC (5 步) → PLAN (5 步) → BUILD (8 步) → SCAN → 下一個 iter
```

### 選擇指南

| 情境 | 推薦路線 | 原因 |
|------|---------|------|
| 全新專案，需求還很模糊 | A (Blueprint) | Gem 對話更自然，分層拆解更直覺 |
| 既有專案，加新功能 | B (Task-Pipe) | POC 可以掃描現有結構 |
| 需求含「彈性」「客製化」 | A (Blueprint) | Round 1.5 變異點分析專門處理 |
| 團隊已熟悉 Task-Pipe | B (Task-Pipe) | 不需要學新工具 |
| 想要最少 AI 推導 | A (Blueprint) | draft-to-plan 是純機械轉換 |

---

## 1. 路線 A: Blueprint Flow

### 1.1 流程圖

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 0: Gemini Gem 對話 (5 輪)                             │
│                                                              │
│  Round 1   目標釐清 ─── 一句話目標 + 族群識別                  │
│      ↓                                                       │
│  Round 1.5 變異點分析 ─── (條件觸發: 偵測到「彈性」等詞)       │
│      ↓                                                       │
│  Round 2   實體識別 ─── 核心實體 + 欄位定義                    │
│      ↓                                                       │
│  Round 3   模組拆分 ─── 共用/獨立模組 + 公開 API               │
│      ↓                                                       │
│  Round 4   迭代規劃 ─── 迭代規劃表 + 排除項目                  │
│      ↓                                                       │
│  Round 5   動作細化 ─── 動作清單 (Full + Stub)                 │
│      ↓                                                       │
│  產出: requirement_draft_iter-N.md (活藍圖)                   │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Blueprint Gate (品質門控)                           │
│                                                              │
│  node sdid-tools/blueprint/gate.cjs --draft=<path>           │
│                                                              │
│  驗證: 格式 + 標籤 + 依賴 + DAG + 佔位符 + 演化層 + 狀態 + 負載  │
│  結果: @PASS → 繼續 | @BLOCKER → 修復                        │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: Draft-to-Plan (機械轉換)                            │
│                                                              │
│  node sdid-tools/blueprint/draft-to-plan.cjs --draft=<path>            │
│       --iter=1 --target=<project>                            │
│                                                              │
│  轉換: 活藍圖動作清單 → implementation_plan per Story          │
│  零 AI 推導，純確定性轉換                                      │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: BUILD (Phase 1-8，與 Task-Pipe 共用)                │
│                                                              │
│  node task-pipe/runner.cjs --phase=BUILD --step=1~8          │
│       --story=Story-X.Y --target=<project>                   │
│                                                              │
│  Phase 1 骨架 → 2 標籤 → 3 測試腳本 → 4 Test Gate            │
│  → 5 TDD → 6 整合測試 → 7 整合檢查 → 8 Fillback              │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: Blueprint Shrink (藍圖收縮)                         │
│                                                              │
│  node sdid-tools/blueprint/shrink.cjs --draft=<path>         │
│       --iter=1 --suggestions=<path>                          │
│                                                              │
│  已完成 iter → 一行摘要 [DONE] 或 [EVOLVED]                   │
│  Stub 保持不動，等下一個 iter 展開                              │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 5: 進入下一個 iter                                     │
│                                                              │
│  (可選) blueprint-expand.cjs → Stub 展開為 Full               │
│  (可選) blueprint-verify.cjs → 藍圖↔源碼比對                  │
│  回到 Phase 1 (Gate) 重新驗證                                 │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 逐步操作

#### Step 1: 準備專案結構

```bash
mkdir my-project
mkdir -p my-project/.gems/iterations/iter-1/poc
mkdir -p my-project/.gems/iterations/iter-1/plan
mkdir -p my-project/.gems/iterations/iter-1/build
mkdir -p my-project/src
```

#### Step 2: 用 Gemini Gem 產出活藍圖

1. 開啟 Gemini Gem (已設定 SDID 藍圖架構師角色)
2. 描述你的需求，Gem 會引導你走 5 輪對話
3. 最終產出一份完整的活藍圖 Markdown
4. 將產出存為: `my-project/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md`

如果沒有 Gemini Gem，也可以用 blueprint-architect 的 prompt:
```bash
# 輸出 AI Agent 用的 system prompt
node task-pipe/tools/blueprint-architect.cjs --prompt

# 輸出 Gemini Gem 角色設定用的 prompt
node task-pipe/tools/blueprint-architect.cjs --gem-prompt

# 輸出空白模板，手動填寫
node task-pipe/tools/blueprint-architect.cjs --template
```

#### Step 3: 執行 Blueprint Gate

```bash
node sdid-tools/blueprint/gate.cjs \
  --draft=my-project/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md \
  --target=my-project
```

可能的結果:
- `@PASS` → log 存檔到 `logs/gate-check-pass-*.log`，繼續 Step 4
- `@BLOCKER` → log 存檔到 `logs/gate-check-error-*.log`，根據修復指引修改藍圖，重跑 Gate

選項:
```bash
# 指定目標 iter (預設自動偵測 [CURRENT])
--iter=1

# 指定專案根目錄 (用於 log 存檔，可省略會自動從 draft 路徑推導)
--target=my-project

# 嚴格模式 (WARN 也算 FAIL)
--strict
```

#### Step 4: 執行 Draft-to-Plan

```bash
node sdid-tools/blueprint/draft-to-plan.cjs \
  --draft=my-project/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md \
  --iter=1 \
  --target=my-project
```

這會自動:
- 解析藍圖中 iter-1 的動作清單
- 按模組分組，每個模組 = 一個 Story
- 產出 `implementation_plan_Story-X.Y.md` 到 `.gems/iterations/iter-1/plan/`
- 自動推導 GEMS 標籤 (GEMS-FLOW, GEMS-DEPS, GEMS-TEST)

#### Step 5: 執行 BUILD Phase 1-8

每個 Story 依序執行:

```bash
# Story-1.0 (通常是 shared/基礎建設)
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=5 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=6 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=7 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=8 --story=Story-1.0 --target=my-project

# Story-1.1 (第二個模組)
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.1 --target=my-project
# ... 重複 step 2-8
```

#### Step 6: 收縮藍圖

```bash
node sdid-tools/blueprint/shrink.cjs \
  --draft=my-project/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md \
  --iter=1 \
  --target=my-project
```

log 存檔: `logs/gate-shrink-pass-*.log`

#### Step 7: (可選) 驗證藍圖↔源碼一致性

> ⚠️ **前置條件**: 需要先執行 `SCAN` 階段產出 `functions.json`，verify 才能比對。
> 若尚未有 `functions.json`，會收到 `ARCHITECTURE_REVIEW` 提示。

```bash
# 先執行 SCAN (如果還沒做)
node task-pipe/runner.cjs --phase=SCAN --target=my-project

# 再驗證
node sdid-tools/blueprint/verify.cjs \
  --draft=my-project/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md \
  --target=my-project \
  --iter=1
```

#### Step 8: 進入 iter-2

```bash
# 展開 Stub 為 Full
node sdid-tools/blueprint/expand.cjs \
  --draft=my-project/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md \
  --iter=2 \
  --suggestions=my-project/.gems/iterations/iter-1/build/

# 重新跑 Gate
node sdid-tools/blueprint/gate.cjs --draft=<updated-draft> --iter=2

# 繼續 draft-to-plan → BUILD → Shrink ...
```

---

## 2. 路線 B: Task-Pipe Flow

### 2.1 流程圖

```
┌─────────────────────────────────────────────────────────────┐
│  POC 階段 (Step 0 → 0.5 → 1 → 2 → 3)                       │
│                                                              │
│  Step 0   模糊消除 ─── 列出所有模糊點，產出 draft             │
│      ↓                                                       │
│  Step 0.5 環境檢查 ─── 選擇 POC 模式 (HTML/TSX)              │
│      ↓                                                       │
│  Step 1   契約設計 ─── @GEMS-CONTRACT + @GEMS-TABLE           │
│      ↓                                                       │
│  Step 2   UI 原型  ─── xxxPOC.html + @GEMS-VERIFIED           │
│      ↓                                                       │
│  Step 3   需求規格 ─── requirement_spec (防膨脹)               │
│                                                              │
│  產出: draft + spec + Contract.ts + POC.html                  │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│  PLAN 階段 (Step 1 → 2 → 2.5 → 2.6 → 3)                     │
│                                                              │
│  Step 1   需求確認 ─── 確認目標模組                            │
│      ↓                                                       │
│  Step 2   規格注入 ─── Contract + Spec → 規格注入              │
│      ↓                                                       │
│  Step 2.5 架構審查 ─── 複雜度/封裝檢核                         │
│      ↓                                                       │
│  Step 2.6 標籤規格 ─── 每個 Item 的 GEMS 標籤模板              │
│      ↓                                                       │
│  Step 3   實作計畫 ─── implementation_plan_Story-X.Y.md        │
│                                                              │
│  每個 Story 重複 Step 1-3                                     │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│  BUILD 階段 (Phase 1-8，每個 Story)                           │
│                                                              │
│  Phase 1  骨架生成 ─── 讀 Plan，寫程式碼 + GEMS 標籤          │
│      ↓                                                       │
│  Phase 2  標籤驗收 ─── The Enforcer，掃描 src 驗證標籤         │
│      ↓                                                       │
│  Phase 3  測試腳本 ─── 依風險等級寫測試                        │
│      ↓                                                       │
│  Phase 4  Test Gate ─── 驗證測試檔案存在 + import 正確         │
│      ↓                                                       │
│  Phase 5  TDD 執行 ─── npm test，100% pass                    │
│      ↓                                                       │
│  Phase 6  整合測試 ─── 修改不破壞現有功能                      │
│      ↓                                                       │
│  Phase 7  整合檢查 ─── 路由/匯出/跨模組依賴                    │
│      ↓                                                       │
│  Phase 8  Fillback ─── Fillback + iteration_suggestions       │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│  SCAN 階段                                                    │
│                                                              │
│  全專案掃描: 標籤完整性 + 規格一致性 + 技術債                  │
│  產出: functions.json + contract.json + tech-stack.json 等     │
└─────────────────────────────────────────────────────────────┘
      ↓
  下一個 Iteration (回到 POC 或 PLAN)
```

### 2.2 逐步操作

#### Step 1: 準備專案結構

```bash
mkdir my-project
mkdir -p my-project/.gems/iterations/iter-1/poc
```

#### Step 2: 建立需求草稿

在 `my-project/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md` 寫入:

```markdown
# Requirement Draft - iter-1

## 狀態
⏳ PENDING

## 專案資訊
- 專案類型: 綠地
- 技術棧: TypeScript
- 專案規模: M

## 需求描述
(你的需求)

## 釐清項目
- [ ] 使用者角色
- [ ] 核心目標
- [ ] 資料結構
- [ ] 邊界條件
```

#### Step 3: 執行 POC

```bash
node task-pipe/runner.cjs --phase=POC --step=0 --target=my-project --level=M
node task-pipe/runner.cjs --phase=POC --step=0.5 --target=my-project
node task-pipe/runner.cjs --phase=POC --step=1 --target=my-project
node task-pipe/runner.cjs --phase=POC --step=2 --target=my-project
node task-pipe/runner.cjs --phase=POC --step=3 --target=my-project
```

每一步的腳本會 print 指令給 AI，AI 讀取後執行，直到 `@PASS`。

POC 產出:
```
.gems/iterations/iter-1/poc/
├── requirement_draft_iter-1.md   (更新後)
├── requirement_spec_iter-1.md    (Step 3 產出)
├── xxxContract.ts                (Step 1 產出)
└── xxxPOC.html                   (Step 2 產出)
```

#### Step 4: 執行 PLAN

每個 Story 重複:

```bash
node task-pipe/runner.cjs --phase=PLAN --step=1 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=PLAN --step=2.5 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=PLAN --step=2.6 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=PLAN --step=3 --story=Story-1.0 --target=my-project
```

PLAN 產出:
```
.gems/iterations/iter-1/plan/
├── implementation_plan_Story-1.0.md
├── implementation_plan_Story-1.1.md
└── ...
```

#### Step 5: 執行 BUILD

每個 Story 依序:

```bash
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=5 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=6 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=7 --story=Story-1.0 --target=my-project
node task-pipe/runner.cjs --phase=BUILD --step=8 --story=Story-1.0 --target=my-project
```

BUILD 產出:
```
.gems/iterations/iter-1/build/
├── Fillback_Story-1.0.md
├── iteration_suggestions_Story-1.0.json
└── ...
```

#### Step 6: 執行 SCAN

```bash
node task-pipe/runner.cjs --phase=SCAN --target=my-project
```

SCAN 產出:
```
.gems/docs/
├── functions.json
├── function-index.json
├── contract.json
├── CONTRACT.md
├── system-blueprint.json
├── schema.json
├── DB_SCHEMA.md
├── tech-stack.json
└── TECH_STACK.md
```

---

## 3. 兩條路線對照表

### 3.1 階段對應

| Blueprint Flow | Task-Pipe Flow | 說明 |
|---------------|----------------|------|
| Gem 對話 Round 1-5 | POC Step 0-3 + PLAN Step 1-3 | Blueprint 把 POC+PLAN 合併為一次對話 |
| blueprint-gate.cjs | POC Step 3 驗證 + PLAN Step 2.5 架構審查 | Gate 一次做完所有驗證 |
| draft-to-plan.cjs | PLAN Step 2-3 (規格注入+實作計畫) | 機械轉換 vs AI 推導 |
| BUILD Phase 1-8 | BUILD Phase 1-8 | 完全相同，共用腳本 |
| blueprint-shrink.cjs | (無對應) | Blueprint 獨有的生命週期管理 |
| blueprint-verify.cjs | SCAN | 類似功能，不同角度 |

### 3.2 產出對應

| 產出 | Blueprint Flow | Task-Pipe Flow |
|------|---------------|----------------|
| 需求草稿 | 活藍圖 (requirement_draft_iter-N.md) | requirement_draft_iter-N.md |
| 需求規格 | (不需要，藍圖即規格) | requirement_spec_iter-N.md |
| 資料契約 | (藍圖內的實體定義) | xxxContract.ts |
| UI 原型 | (不產出) | xxxPOC.html |
| 實作計畫 | draft-to-plan 自動產出 | PLAN Step 3 AI 產出 |
| 程式碼 | BUILD 產出 | BUILD 產出 |
| Fillback | BUILD Phase 8 | BUILD Phase 8 |
| 收縮藍圖 | blueprint-shrink 產出 | (無) |

### 3.3 工具清單

| 工具 | 路徑 | 用途 | 所屬路線 |
|------|------|------|---------|
| blueprint-architect.cjs | task-pipe/tools/ | 產出 Gem prompt / 驗證 Draft | A |
| blueprint-gate.cjs | sdid-tools/ | 藍圖品質門控 | A |
| draft-to-plan.cjs | sdid-tools/ | 藍圖→執行計畫 | A |
| blueprint-shrink.cjs | sdid-tools/ | 藍圖收縮 | A |
| blueprint-expand.cjs | sdid-tools/ | Stub 展開 | A |
| blueprint-verify.cjs | sdid-tools/ | 藍圖↔源碼比對 | A |
| runner.cjs | task-pipe/ | Task-Pipe 主入口 | B (BUILD 共用) |
| draft-parser-standalone.cjs | sdid-tools/lib/ | 藍圖解析器 | A |
| log-output.cjs | sdid-tools/lib/ | Log 存檔 (獨立版) | A |
| log-output.cjs | task-pipe/lib/shared/ | Log 存檔 (task-pipe 版) | B |

---

## 4. BUILD Phase 詳解 (兩條路線共用)

BUILD 是兩條路線的交會點，Phase 1-8 完全相同。

### 4.1 Phase 速查表

| Phase | 名稱 | 做什麼 | 通過條件 | 失敗處理 |
|-------|------|--------|---------|---------|
| 1 | 骨架生成 | 讀 Plan，寫程式碼 + GEMS 標籤 | getDiagnostics() = 0 | BLOCKER |
| 2 | 標籤驗收 | 掃描 src，驗證 GEMS 標籤完整 | coverage ≥ 80% | TACTICAL_FIX |
| 3 | 測試腳本 | 依風險等級寫測試 | getDiagnostics() = 0 | BLOCKER |
| 4 | Test Gate | 驗證測試檔案存在 + import 正確 | P0/P1 測試 100% | TACTICAL_FIX |
| 5 | TDD 執行 | npm test | passRate = 100% | TACTICAL_FIX |
| 6 | 整合測試 | 確保修改不破壞現有功能 | 所有測試通過 | TACTICAL_FIX |
| 7 | 整合檢查 | 路由/匯出/跨模組依賴 | Checklist 完成 | PENDING |
| 8 | Fillback | 產出 Fillback + Suggestions | 必填欄位驗證 | TACTICAL_FIX |

### 4.2 測試風險等級

| 優先級 | 測試要求 | 說明 |
|--------|---------|------|
| P0 | Unit + Integration + E2E | 端到端協議 (API/DB) |
| P1 | Unit + Integration | 整合依賴 (跨模組) |
| P2 | Unit | 獨立功能 |
| P3 | Unit (可選) | 輔助功能 |

### 4.3 錯誤處理: 三層策略漂移

```
Level 1 (重試 1-3 次): TACTICAL_FIX — 局部修補
Level 2 (重試 4-6 次): STRATEGY_SHIFT — 換方式實作
Level 3 (重試 7+ 次): PLAN_ROLLBACK — 回退 PLAN 階段
```

### 4.4 Log 輸出與存檔 (v1.1 新增)

所有階段的門控結果都會自動存檔到 `.gems/iterations/iter-X/logs/`，sdid-tools 和 task-pipe 的 log 匯流到同一個目錄。

#### Log 檔名格式

```
{phase}-{step}-[{Story}]-{type}-{timestamp}.log
```

| 來源 | phase | step | 範例檔名 |
|------|-------|------|---------|
| blueprint-gate | `gate` | `check` | `gate-check-pass-2026-02-13T04-03-33.log` |
| draft-to-plan | `gate` | `plan` | `gate-plan-pass-2026-02-13T04-03-34.log` |
| blueprint-shrink | `gate` | `shrink` | `gate-shrink-pass-2026-02-13T04-03-35.log` |
| blueprint-expand | `gate` | `expand` | `gate-expand-pass-2026-02-13T04-03-35.log` |
| blueprint-verify | `gate` | `verify` | `gate-verify-pass-2026-02-13T04-03-36.log` |
| BUILD Phase 1-8 | `build` | `phase-N` | `build-phase-2-Story-1.0-error-2026-02-10T16-10-25.log` |

#### Log type 對照

| type | 意義 | 觸發時機 |
|------|------|---------|
| `pass` | 門控通過 | @PASS |
| `error` | 門控失敗 | @BLOCKER / @TACTICAL_FIX |
| `error-spec` | 精準錯誤 (含範例) | anchorErrorSpec |
| `template` | 模板待填寫 | anchorTemplatePending |
| `fix` | 修復建議 | TACTICAL_FIX |
| `info` | 一般資訊 | anchorOutput |
| `pending` | 待處理 | 需要人工確認 |

#### 錯誤處理模式 (v1.2 新增)

所有 sdid-tools 門控都對齊 task-pipe BUILD phase 的錯誤處理模式：

| 情境 | 輸出 API | log type | AI 行動 |
|------|---------|----------|---------|
| 缺少 CLI 參數 | `anchorErrorSpec` | `error-spec` | 讀取範例，補齊參數重跑 |
| 藍圖解析失敗 | `anchorError(BLOCKER)` | `error` | 先跑 Gate 確認格式 |
| 目標 iter 無模組 | `anchorError(BLOCKER)` | `error` | 確認 iter 編號或展開 Stub |
| 所有模組被跳過 | `anchorError(BLOCKER/TACTICAL_FIX)` | `error` | 讀取 log 詳情修復 |
| 門控通過 | `anchorPass` | `pass` | 讀取「下一步」指令 |

每個門控的 `gateSpec` 會列出該步驟會檢查的項目，讓 AI 預先知道需要什麼：

```
blueprint-gate:   格式 + 標籤 + 依賴 + DAG + 佔位符 + 演化層 + 草稿狀態 + Level限制 + 依賴一致性 + 迭代負載
draft-to-plan:    --draft + --target + 藍圖可解析 + iter 有模組 + 動作非空
blueprint-shrink: --draft + 藍圖可解析 + iter 有可收縮模組 + BUILD 已完成
blueprint-expand: --draft + 藍圖可解析 + iter 有 Stub + 前一 iter 已收縮
blueprint-verify: --draft + functions.json 存在 + 藍圖動作可提取
```

#### 完整流程的 logs/ 目錄範例

```
.gems/iterations/iter-1/logs/
├── gate-check-pass-2026-02-13T04-03-33.log       ← Gate 通過
├── gate-plan-pass-2026-02-13T04-03-34.log        ← Plan 產出
├── build-phase-1-Story-1.0-pass-...log            ← BUILD 骨架
├── build-phase-2-Story-1.0-template-...log        ← BUILD 標籤模板
├── build-phase-2-Story-1.0-error-...log           ← BUILD 標籤修復
├── build-phase-5-Story-1.0-pass-...log            ← BUILD TDD 通過
├── build-phase-8-Story-1.0-pass-...log            ← BUILD Fillback
├── gate-shrink-pass-2026-02-13T04-05-00.log       ← 收縮完成
└── gate-verify-pass-2026-02-13T04-05-30.log       ← 驗證通過
```

#### 如何讀取 log

AI 在修復錯誤時，可以直接讀取 `logs/` 目錄中的 error log 取得完整詳情：

```bash
# 列出所有 error log
ls .gems/iterations/iter-1/logs/*error*

# 讀取最新的 error log
cat .gems/iterations/iter-1/logs/gate-check-error-2026-02-13T04-03-33.log
```

#### --target 參數

sdid-tools 的門控工具需要 `--target` 參數來決定 log 存檔位置：

```bash
# 明確指定 (推薦)
node sdid-tools/blueprint/gate.cjs --draft=<path> --target=my-project

# 自動推導 (從 draft 路徑中的 .gems/iterations/ 推導)
node sdid-tools/blueprint/gate.cjs --draft=my-project/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md
# → 自動推導 projectRoot = my-project
```

---

## 5. 常見場景操作範例

### 5.1 場景: 全新計算機應用 (Blueprint Flow)

```bash
# 1. 建立專案
mkdir calculator && mkdir -p calculator/.gems/iterations/iter-1/{poc,plan,build} && mkdir calculator/src

# 2. 用 Gem 產出藍圖 (或手動填模板)
node task-pipe/tools/blueprint-architect.cjs --template > calculator/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md
# 編輯填入實際內容...

# 3. Gate 驗證
node sdid-tools/blueprint/gate.cjs --draft=calculator/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md --target=calculator

# 4. 產出執行計畫
node sdid-tools/blueprint/draft-to-plan.cjs --draft=calculator/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md --iter=1 --target=calculator

# 5. BUILD (每個 Story)
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --target=calculator
# ... step 2-8

# 6. 收縮藍圖
node sdid-tools/blueprint/shrink.cjs --draft=calculator/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md --iter=1 --target=calculator

# 7. 查看完整 log 記錄
ls calculator/.gems/iterations/iter-1/logs/
```

### 5.2 場景: 既有專案加功能 (Task-Pipe Flow)

```bash
# 1. 建立新迭代
mkdir -p existing-app/.gems/iterations/iter-2/poc

# 2. (可選) 掃描現有結構
node task-pipe/runner.cjs --phase=SCAN --target=existing-app

# 3. 建立 requirement_draft_iter-2.md

# 4. POC
node task-pipe/runner.cjs --phase=POC --step=0 --target=existing-app --iteration=iter-2
# ... step 0.5, 1, 2, 3

# 5. PLAN (每個 Story)
node task-pipe/runner.cjs --phase=PLAN --step=1 --story=Story-2.0 --target=existing-app
# ... step 2, 2.5, 2.6, 3

# 6. BUILD (每個 Story)
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-2.0 --target=existing-app
# ... step 2-8

# 7. SCAN
node task-pipe/runner.cjs --phase=SCAN --target=existing-app
```

### 5.3 場景: 需求含「彈性」「客製化」(Blueprint Flow + 變異點)

```bash
# 1. 用 Gem 對話，Round 1 描述需求時提到「客製化」「每週不同」
#    Gem 會自動觸發 Round 1.5 變異點分析
#    產出: 名詞分析表 + 分層定義 (BASE → L1 → L2 ...)

# 2. 使用者確認: 「先做到 L2」
#    L3+ 自動標記 [STUB]

# 3. Gate 驗證 (會檢查演化層依賴)
node sdid-tools/blueprint/gate.cjs --draft=<path>

# 4. draft-to-plan (會處理 Modify 動作)
node sdid-tools/blueprint/draft-to-plan.cjs --draft=<path> --iter=1 --target=<project>

# 5. BUILD → Shrink → iter-2 展開 L3 ...
```

---

## 6. GEMS 標籤速查

```typescript
/**
 * GEMS: functionName | P[0-3] | ✓✓ | (args)→Result | Story-X.X | 描述
 * GEMS-FLOW: Step1→Step2→Step3
 * GEMS-DEPS: [Type.Name (說明)], [Type.Name (說明)]
 * GEMS-DEPS-RISK: LOW | MEDIUM | HIGH
 * GEMS-TEST: ac-runner          ← 純計算 + 有 AC（最強驗收）
 * GEMS-TEST: jest-unit          ← 純計算，無 AC
 * GEMS-TEST: jest-integ         ← 跨邊界格式轉換（DEPS-RISK MEDIUM+）
 * GEMS-TEST: poc-html           ← 外部資源（GAS/fetch/DOM）
 * GEMS-TEST: skip               ← 無 A/B/C 條件，不需要 Jest
 * GEMS-TEST-FILE: xxx.test.ts   ← 只有 jest-unit / jest-integ 需要填
 */
// AC-X.Y                    ← 驗收條件 ID（在標籤後、[STEP] 前，P0/P1 必填）
// [STEP] Step1
```

**測試策略推導規則（機械推導，不靠 AI 主觀）**：

| 條件 | 訊號來源 | 策略 |
|------|---------|------|
| A: 非顯然計算 | GEMS-FLOW 含 CALC/PARSE/CONVERT/FORMAT/ROC/DATE | `ac-runner`（有AC）或 `jest-unit` |
| B: 跨邊界格式 | DEPS-RISK MEDIUM+ 且有 deps | `jest-integ` |
| C: 外部資源 | GEMS-FLOW 含 GAS/SHEET/FETCH/DOM | `poc-html` |
| 無 A/B/C | — | `skip` |

條件 C 優先於 A/B。`draft-to-plan.cjs` 在 Gate 階段自動推導並寫入骨架，Phase 3 只執行策略，無自由裁量。

---

## 7. 故障排除

| 問題 | 原因 | 解法 |
|------|------|------|
| Gate 報 FMT-001 | 一句話目標太短 | 補到 ≥10 字 |
| Gate 報 TAG-003 | flow 欄位空白 | 補 3-7 步的 STEP1→STEP2→STEP3 |
| Gate 報 EVO-001 | BASE 依賴 L1 | 調整依賴方向或演化層標記 |
| Gate 報 DAG-001 | iter-2 依賴 iter-3 | 確保只依賴同期或更早的 iter |
| Gate 報 CONS-001 | 迭代規劃表的模組名跟動作清單不匹配 | 確保每個模組獨占一行，不要寫 `shared, todoCore` 合併 |
| Gate 報 CONS-002 | 動作清單的模組不在迭代規劃表中 | 在迭代規劃表新增該模組的行 |
| Gate 報 STS-002 | 草稿狀態是 PENDING | 完成所有釐清項目後改為 [x] DONE |
| Gate 報 LVL-001 (BLOCKER) | 模組數嚴重超過 Level 限制 | 升級 Level (S→M 或 M→L) |
| Gate 報 DEPCON-001 | 模組定義有 deps 但迭代規劃表 deps 為空 | 同步迭代規劃表的依賴欄位 |
| Gate 報 DEPCON-002 | 動作清單 item deps 全是「無」但模組有依賴 | 在動作清單標註具體依賴 |
| Gate 報 LOAD-001 | 單一 iter 模組數過多 | 將部分模組移到下一個 iter |
| Gate 報 PH-001 | 有 {placeholder} | 替換為實際內容 |
| BUILD Phase 2 FAIL | GEMS 標籤缺失 | 補齊標籤，重跑 Phase 2 |
| BUILD Phase 5 FAIL | 測試不通過 | TACTICAL_FIX，最多 3 次 |
| draft-to-plan 無產出 | 藍圖沒有 [CURRENT] iter | 加 [CURRENT] 標記 |
| verify crash | functions.json 不存在 | 先跑 SCAN 階段產出 functions.json |
| PowerShell 編碼亂碼 | Windows 編碼問題 | 用 Node.js 腳本讀 log: `node -e "console.log(require('fs').readFileSync('path','utf8'))"` |
| log 沒有存檔 | 沒有指定 --target | 加 --target=<project> 或確保 draft 路徑含 .gems/ |
| logs/ 目錄找不到 | 目錄不存在 | log-output 會自動建立，確認 --target 路徑正確 |

---

**文件版本**: v1.3 | **方法論**: SDID v2.1 | **日期**: 2026-02-13
