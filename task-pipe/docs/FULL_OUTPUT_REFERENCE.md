# Task-Pipe & Blueprint Flow — 全階段輸出對齊參考

> 所有 Phase/Step 的 PASS、ERROR、BLOCKER、TEMPLATE 輸出格式一覽
> 生成日期: 2026-02-14

---

## 📊 輸出標記總覽 (Output Markers)

| 標記 | 含義 | 出現場景 |
|------|------|---------|
| `@PASS` | 門控通過 | 所有 Phase/Step 成功時 |
| `@BLOCKER` | 結構性問題，必須修復 | 重試超限 / 架構問題 |
| `@TACTICAL_FIX` | 局部修補，可重試 | 重試 1-3 次 |
| `@STRATEGY_SHIFT` | 換方式實作 | 重試 4-6 次 |
| `@PLAN_ROLLBACK` | 回退 PLAN 階段 | 重試 7+ 次 |
| `@ARCHITECTURE_REVIEW` | 需架構師介入 | 重試超限升級 |
| `@ERROR_SPEC` | 精準錯誤（目標檔+缺少項+範例） | 具體修復指引 |
| `@TEMPLATE_PENDING` | 需要 AI 填寫模板 | 新建檔案時 |
| `@TASK` | 指令式任務區塊 | emitTaskBlock 輸出 |
| `@NEXT_COMMAND` | 下一步指令 | 修復後執行 |
| `@CONTEXT` | 精簡上下文 | anchorOutput 輸出 |
| `@INFO` | 結構化資訊 | anchorOutput 輸出 |
| `@GUIDE` | 指引內容 | anchorOutput 輸出 |
| `@RULES` | 規則列表 | anchorOutput 輸出 |
| `@GATE_SPEC` | 門控驗證邏輯 | 告訴 AI 本步驟檢查什麼 |
| `@FORBIDDEN` | 施工紅線 | 禁止修改工具腳本 |
| `@REPEAT-RULE` | 施工紅線重複確認 | 每次錯誤輸出結尾 |
| `@TAINT_ANALYSIS` | 染色分析結果 | 修改 P0 函式後 |
| `@INCREMENTAL_HINT` | 增量驗證建議 | 策略漂移時 |
| `@STRATEGY_DRIFT` | 策略漂移資訊 | 重試升級時 |
| `@REMINDER` | 關鍵指令重複確認 | emitTaskBlock 結尾 |
| `@LOG` | log 檔案路徑 | 模板存檔後 |
| `@NEEDS_CLARIFICATION` | 需要澄清 | POC 模糊消除 |
| `@GEMS-VERIFIED` | POC 功能驗證標籤 | POC Step 4 |
| `@GEMS-CONTRACT` | 契約設計標籤 | POC Step 3 |

---

## 📁 Log 檔案命名規則

```
.gems/iterations/iter-X/logs/{phase}-{step}-{story?}-{type}-{timestamp}.log
```

| 欄位 | 範例 |
|------|------|
| phase | `poc`, `plan`, `build`, `scan`, `gate-check`, `gate-plan`, `gate-shrink`, `gate-expand`, `gate-verify` |
| step | `step-1`, `phase-2`, `scan` |
| story | `Story-1.0` (PLAN/BUILD 才有) |
| type | `pass`, `error`, `fix`, `template`, `info` |
| timestamp | `2026-02-14T11-30-00` |

---

## 🔵 路線 B: Task-Pipe Flow (POC → PLAN → BUILD → SCAN)


### ═══════════════════════════════════════
### POC 階段 (Step 1-5)
### ═══════════════════════════════════════

#### POC Step 1: 模糊消除 + 邏輯預檢

```
輸入: requirement_draft_iter-X.md
產物: 驗證過的 draft
指令: node task-pipe/runner.cjs --phase=POC --step=1 --target=<path>
```

**@PASS 輸出:**
```
@PASS | POC Step 1 | Draft 驗證通過，{N} 個功能需求已確認
下一步: node task-pipe/runner.cjs --phase=POC --step=2 --target=<path>
```

**@TACTICAL_FIX 輸出 (draft 不存在):**
```
@CONTEXT
POC Step 1 | 未找到 draft

@TACTICAL_FIX (1/3)
未找到 requirement_draft_iter-X.md

@RECOVERY_ACTION (Level 1)
建立 .gems/iterations/iter-X/poc/requirement_draft_iter-X.md

修復後: node task-pipe/runner.cjs --phase=POC --step=1 --target=<path>
```

**@BLOCKER 輸出 (重試超限):**
```
@ARCHITECTURE_REVIEW | 需求確認需要進一步完善 (3/3)
修復後: 建議：確認 draft 完成狀態，或架構師介入協作
詳情: .gems/iterations/iter-X/logs/poc-step-1-error-{timestamp}.log

@REPEAT-RULE (施工紅線)
🚫 禁止修改 task-pipe/ | ✅ 只能修改專案檔案
```

**特殊功能:** 自動偵測前一迭代的 `iteration_suggestions` 或 SCAN 的 `functions.json`

---

#### POC Step 2: 環境檢查 + POC 模式選擇

```
輸入: requirement_draft
產物: 更新 draft（加入 POC 模式 TSX/HTML）
指令: node task-pipe/runner.cjs --phase=POC --step=2 --target=<path>
```

**@PASS 輸出:**
```
@PASS | POC Step 2 | 環境檢查完成，模式: HTML POC
下一步: node task-pipe/runner.cjs --phase=POC --step=3 --target=<path>
```

**@TACTICAL_FIX 輸出:**
```
@CONTEXT
POC Step 2 | 未找到 draft

@TACTICAL_FIX (1/3)
未找到 requirement_draft

@RECOVERY_ACTION (Level 1)
執行 Step 1 產出 draft

建議先執行: node task-pipe/runner.cjs --phase=POC --step=1
```

**@BLOCKER 輸出 (重試超限):**
```
@ARCHITECTURE_REVIEW | 環境檢查需要進一步確認 (3/3)
修復後: 建議：確認 Step 1 完成狀態，或架構師介入協作
詳情: .gems/iterations/iter-X/logs/poc-step-2-error-{timestamp}.log
```

---

#### POC Step 3: 契約設計

```
輸入: requirement_draft
產物: xxxContract.ts (含 @GEMS-CONTRACT, @GEMS-TABLE, @GEMS-FUNCTION)
指令: node task-pipe/runner.cjs --phase=POC --step=3 --target=<path>
```

**@PASS 輸出:**
```
@PASS | POC Step 3 | Contract 驗證通過
下一步: node task-pipe/runner.cjs --phase=POC --step=4 --target=<path>
```

**@ERROR_SPEC 輸出 (標籤缺失):**
```
═══════════════════════════════════════════════════════════
@ERROR_SPEC (1/3)
═══════════════════════════════════════════════════════════
📁 目標檔案: .gems/iterations/iter-X/poc/xxxContract.ts
❌ 缺少項目: @GEMS-CONTRACT, @GEMS-TABLE, @GEMS-FUNCTION

@GATE_SPEC (本步驟驗證邏輯)
  ❌ @GEMS-CONTRACT: /@GEMS-CONTRACT/
  ❌ @GEMS-TABLE: /@GEMS-TABLE/
  ❌ @GEMS-FUNCTION: /@GEMS-FUNCTION/

📋 範例 (可直接複製):
---
/**
 * @GEMS-CONTRACT: ModuleName
 * @GEMS-VERSION: 1.0
 */
// @GEMS-TABLE: items
export interface Item {
  id: string;      // UUID, PK
  title: string;   // VARCHAR(100), NOT NULL
}
/**
 * @GEMS-FUNCTION: createItem | P0
 * @DESC: 建立新項目
 * @ARGS: title: string
 * @RETURN: Item
 */
---

✅ 修復後執行: node task-pipe/runner.cjs --phase=POC --step=1

@FORBIDDEN (施工紅線)
  🚫 禁止讀取 task-pipe/*.cjs 工具腳本
  🚫 禁止修改 .gems/iterations/*/logs/ 目錄
  ✅ 只能修改上方「目標檔案」
═══════════════════════════════════════════════════════════
```

**Gate 檢查項:**
| 檢查 | Pattern |
|------|---------|
| @GEMS-CONTRACT | `/@GEMS-CONTRACT/` |
| @GEMS-TABLE | `/@GEMS-TABLE/` |
| @GEMS-FUNCTION | `/@GEMS-FUNCTION/` |

---

#### POC Step 4: UI 原型設計 (嚴格審查版)

```
輸入: draft + Contract
產物: xxxPOC.html (含 @GEMS-VERIFIED)
指令: node task-pipe/runner.cjs --phase=POC --step=4 --target=<path>
```

**@PASS 輸出:**
```
@PASS | POC Step 4 | POC 品質檢查通過
下一步: node task-pipe/runner.cjs --phase=POC --step=5 --target=<path>
```

**@TACTICAL_FIX 輸出 (品質問題):**
```
@CONTEXT
POC Step 4 | POC 品質不足

[QUALITY_BLOCKERS] N 個 BLOCKER:
  ❌ [1] @GEMS-VERIFIED 勾選項目無對應函式
     修復: 確保每個 [x] 項目都有 @GEMS-FUNCTION 實作

[QUALITY_WARNINGS] N 個警告:
  ⚠️ [1] Mock 資料不完整

[QUALITY_STATS] 偵測結果:
  函式(@GEMS-FUNCTION): N 個
  實際函式(function/const): N 個
  Mock 資料: N 筆
  @GEMS-VERIFIED 勾選: N 個

修復後: node task-pipe/runner.cjs --phase=POC --step=4 --target=<path>
```

**Gate 檢查項:**
| 檢查 | 說明 |
|------|------|
| @GEMS-VERIFIED 存在 | POC 必須有功能驗證標籤 |
| 勾選項有對應函式 | `[x]` 項目必須有 `@GEMS-FUNCTION` |
| Mock 資料符合 Contract | 欄位必須與 Contract 一致 |
| 設計品質 | 佈局、互動、可用性 |

---

#### POC Step 5: 需求規格產出 (防膨脹版)

```
輸入: draft + Contract + POC
產物: requirement_spec_iter-X.md
指令: node task-pipe/runner.cjs --phase=POC --step=5 --target=<path> --level=S|M|L
```

**@PASS 輸出:**
```
@PASS | POC Step 5 | 需求規格驗證通過
下一步: node task-pipe/runner.cjs --phase=PLAN --step=1 --target=<path>
```

**@ERROR_SPEC 輸出:**
```
═══════════════════════════════════════════════════════════
@ERROR_SPEC (1/3)
═══════════════════════════════════════════════════════════
📁 目標檔案: .gems/iterations/iter-X/poc/requirement_spec_iter-X.md
❌ 缺少項目: 缺用戶故事, 缺驗收標準, 缺範疇聲明

@GATE_SPEC (本步驟驗證邏輯)
  ❌ 用戶故事: /Story.*\d+\.\d+/
  ❌ 驗收標準: /AC-\d+/
  ✅ 獨立可測性: /驗證|不驗證/

📋 範例 (可直接複製):
---
## 1. 用戶故事
### Story 1.0: 基礎建設 [已驗證]
作為 開發者，我想要 建立專案基礎架構

## 3. 驗收標準
### AC-1.0
Given ... When ... Then ...

## 0. 範疇聲明 (Scope Declaration)
### 已驗證功能 (POC Verified)
- 列表顯示
### 延期功能 (DEFERRED)
- 無
---

✅ 修復後執行: node task-pipe/runner.cjs --phase=POC --step=3
═══════════════════════════════════════════════════════════
```

**Gate 檢查項:**
| 檢查 | 說明 |
|------|------|
| 用戶故事 | Story N.N 格式 |
| 驗收標準 | AC-N.N 格式 |
| 獨立可測性 | ✅/❌ 標記 |
| 範疇聲明 | 已驗證 + DEFERRED |
| Level 限制 | S≤3 Stories, M≤6, L≤10 |


---

### ═══════════════════════════════════════
### PLAN 階段 (Step 1-5)
### ═══════════════════════════════════════

#### PLAN Step 1: 需求確認 & 模糊消除

```
輸入: POC 產出 (requirement_spec)
產物: 確認可進入 Step 2
指令: node task-pipe/runner.cjs --phase=PLAN --step=1 --target=<path>
```

**@PASS 輸出:**
```
@PASS | PLAN Step 1 | Spec 驗證通過，{N} 個 Story 已確認
下一步: node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-X.Y --target=<path>
```

**@TACTICAL_FIX 輸出 (Spec 不完整):**
```
@CONTEXT
PLAN Step 1 | Spec 不完整

@INFO
  Spec: .gems/iterations/iter-X/poc/requirement_spec_iter-X.md
  缺少: 用戶故事, 驗收標準

@TACTICAL_FIX (1/3)
[SPEC INCOMPLETE] 缺: 用戶故事, 驗收標準

@RECOVERY_ACTION (Level 1)
補充缺少的必要區塊

禁止繼續 | 補充後重跑: node task-pipe/runner.cjs --phase=PLAN --step=1
```

**@BLOCKER 輸出 (Spec 不存在):**
```
@ARCHITECTURE_REVIEW | 需求確認需要進一步完善 (3/3)
修復後: 建議：架構師協作，確認 POC Step 3 完成狀態
詳情: .gems/iterations/iter-X/logs/plan-step-1-error-{timestamp}.log
```

**Gate 檢查項:**
| 檢查 | 說明 | Critical |
|------|------|----------|
| requirement_spec 存在 | 檔案必須存在 | ✅ |
| 用戶故事 | Story 格式正確 | ✅ |
| 驗收標準 | AC 格式正確 | ✅ |
| 獨立可測性 | 有標記 | ❌ |

---

#### PLAN Step 2: 規格注入

```
輸入: requirement_spec + Contract
產物: implementation_plan_Story-X.Y.md 初稿
指令: node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | PLAN Step 2 | 已完成: .gems/iterations/iter-X/plan/implementation_plan_Story-X.Y.md
下一步: node task-pipe/runner.cjs --phase=PLAN --step=2.5 --story=Story-X.Y
```

**@TEMPLATE_PENDING 輸出 (Plan 不存在，需建立):**
```
═══════════════════════════════════════════════════════════
@TEMPLATE_PENDING
═══════════════════════════════════════════════════════════
📁 目標檔案: .gems/iterations/iter-X/plan/implementation_plan_Story-X.Y.md

@GATE_SPEC (本步驟驗證邏輯 - 填寫後會檢查這些)
  ⏳ Story 目標: /Story 目標|一句話目標/i
  ⏳ 工作項目: /工作項目|Item.*\|/i
  ⏳ 規格注入: /@GEMS-CONTRACT|規格注入|interface/i

📝 需要填寫的項目:
  1. Story 目標
  2. 工作項目表格
  3. 規格注入 (Contract)

📋 模板內容:
---
{模板內容}
---

✅ 填寫完成後執行: node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-X.Y

@FORBIDDEN (施工紅線)
  🚫 禁止讀取 task-pipe/*.cjs 工具腳本
  ✅ 只能修改上方「目標檔案」
═══════════════════════════════════════════════════════════
```

**@ERROR_SPEC 輸出 (Plan 不完整):**
```
═══════════════════════════════════════════════════════════
@ERROR_SPEC (1/3)
═══════════════════════════════════════════════════════════
📁 目標檔案: .gems/iterations/iter-X/plan/implementation_plan_Story-X.Y.md
❌ 缺少項目: Story 目標, 工作項目, 規格注入

@GATE_SPEC (本步驟驗證邏輯)
  ❌ Story 目標: /Story 目標|一句話目標/i
  ✅ 工作項目: /工作項目|Item.*\|/i
  ❌ 規格注入: /@GEMS-CONTRACT|規格注入|interface/i

📋 範例 (可直接複製):
---
## 1. Story 目標
**一句話目標**: 實作 Story-X.Y 的核心功能

## 3. 工作項目
| Item | 名稱 | Type | Priority | 預估 |
|------|------|------|----------|------|
| 1 | 新增功能 | FEATURE | P0 | 2h |

## 5. 規格注入
```typescript
// @GEMS-CONTRACT: EntityName
interface EntityName { id: string; name: string; }
```
---

✅ 修復後執行: node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-X.Y
═══════════════════════════════════════════════════════════
```

**Gate 檢查項:**
| 檢查 | Pattern |
|------|---------|
| Story 目標 | `/Story 目標\|一句話目標/i` |
| 工作項目 | `/工作項目\|Item.*\|/i` |
| 規格注入 | `/@GEMS-CONTRACT\|規格注入\|interface/i` |

---

#### PLAN Step 3: 架構審查 (Constitution Audit) v4.0

```
輸入: implementation_plan 初稿
產物: 更新 plan（加入審查結果）
指令: node task-pipe/runner.cjs --phase=PLAN --step=3 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | PLAN Step 3 | 架構審查通過 (HARD: N/N, SOFT: N/N)
下一步: node task-pipe/runner.cjs --phase=PLAN --step=4 --story=Story-X.Y --target=<path>
```

**分級驗證:**

HARD GATE (Story-X.0 基礎建設):
| 檢查 | 修復提示 |
|------|---------|
| GEMS 標籤 | 加入 `/** GEMS: functionName \| P0 \| ... */` |
| 架構分層 | 加入 config/lib/shared/modules 說明 |
| 入口點 | 加入 main.ts / index.html 規劃 |

HARD GATE (Story-X.N 功能模組):
| 檢查 | 修復提示 |
|------|---------|
| GEMS 標籤 | 加入 GEMS 標籤區塊 |
| 架構審查區塊 | 加入 `## 架構審查 (Constitution Audit)` |
| Priority 標記 | GEMS 標籤中標記 P0-P3 |

SOFT WARN (不阻擋):
| 檢查 | 說明 |
|------|------|
| 啟動方式 | npm run dev |
| Integration 測試規範 | 禁止 mock 核心邏輯 |
| E2E 場景規劃 | playwright/cypress |
| 模組隔離檢核 | Facade / index.ts |

---

#### PLAN Step 4: 標籤規格設計 (GEMS Tags v2.1)

```
輸入: implementation_plan
產物: 更新 plan（加入完整 GEMS 標籤規格）
指令: node task-pipe/runner.cjs --phase=PLAN --step=4 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | PLAN Step 4 | 標籤規格驗證通過
下一步: node task-pipe/runner.cjs --phase=PLAN --step=5 --story=Story-X.Y --target=<path>
```

**Gate 檢查項 (v2.1 嚴格驗證):**
| 檢查 | Pattern |
|------|---------|
| GEMS 基本標籤 | `GEMS: funcName \| P[0-3] \| ✓✓ \| (args)→Result \| Story-X.X \| 描述` |
| GEMS-FLOW | `Step1→Step2→Step3` |
| GEMS-DEPS | `[Type.Name (說明)]` |
| GEMS-DEPS-RISK | `LOW \| MEDIUM \| HIGH` |
| GEMS-TEST | `✓ Unit \| ✓ Integration \| - E2E` |
| GEMS-TEST-FILE | `xxx.test.ts` |
| [STEP] 錨點 | P0/P1 強制 |
| 函式清單表格 | v2.2 新增 |

---

#### PLAN Step 5: 完成 Implementation Plan

```
輸入: implementation_plan (完整版)
產物: 確認 READY FOR BUILD
指令: node task-pipe/runner.cjs --phase=PLAN --step=5 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | PLAN Step 5 | Plan 驗證通過，READY FOR BUILD
下一步: node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y --target=<path>
```

**@ERROR_SPEC 輸出:**
```
═══════════════════════════════════════════════════════════
@ERROR_SPEC (1/3)
═══════════════════════════════════════════════════════════
📁 目標檔案: .gems/iterations/iter-X/plan/implementation_plan_Story-X.Y.md
❌ 缺少項目: Story 目標, 資料契約, 功能清單, 架構審查, 標籤規格

@GATE_SPEC (本步驟驗證邏輯)
  ❌ Story 目標
  ❌ 資料契約
  ✅ 功能清單
  ❌ 架構審查
  ❌ 標籤規格

📋 範例 (可直接複製):
---
{完整 Plan 範例}
---

✅ 修復後執行: node task-pipe/runner.cjs --phase=PLAN --step=3 --story=Story-X.Y
═══════════════════════════════════════════════════════════
```

**Gate 檢查項:**
| 檢查 | 說明 |
|------|------|
| Story 目標 | 一句話目標 + 範圍 |
| 資料契約 | @GEMS-CONTRACT |
| 功能清單 | 函式表格 |
| 架構審查 | Constitution Audit |
| 標籤規格 | 完整 GEMS 標籤 |
| 與 Spec 勾稽 | Story 對應 requirement_spec |


---

### ═══════════════════════════════════════
### BUILD 階段 (Phase 1-8)
### ═══════════════════════════════════════

#### BUILD Phase 1: 開發腳本 (骨架建立)

```
輸入: implementation_plan
產物: 功能程式碼骨架 + checkpoint
指令: node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | BUILD Phase 1 | 骨架建立完成
下一步: node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y --target=<path>
```

**@TEMPLATE_PENDING 輸出 (需建立骨架):**
```
═══════════════════════════════════════════════════════════
@TEMPLATE_PENDING
═══════════════════════════════════════════════════════════
📁 目標檔案: src/modules/xxx/...

@GATE_SPEC (本步驟驗證邏輯 - 填寫後會檢查這些)
  ⏳ package.json: 專案設定檔存在
  ⏳ Config Layer: src/config/
  ⏳ Shared Layer: src/shared/
  ⏳ Modules Layer: src/modules/

@PLAN_SPECS (Plan 標籤規格)
{從 Plan 提取的完整 GEMS 標籤，AI 可直接複製}

📝 需要填寫的項目:
  1. 建立目錄結構
  2. 建立骨架檔案
  3. 加入 GEMS 標籤

✅ 填寫完成後執行: node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y

@FORBIDDEN (施工紅線)
  🚫 禁止讀取 task-pipe/*.cjs 工具腳本
  ✅ 只能修改上方「目標檔案」
═══════════════════════════════════════════════════════════
```

**Gate 檢查項:**
| 檢查 | Pattern | Required |
|------|---------|----------|
| package.json | 專案設定檔存在 | ✅ |
| Config Layer | `src/config/` | ✅ |
| Shared Layer | `src/shared/` | ✅ |
| Modules Layer | `src/modules/` | ✅ |
| Assets Layer | `src/assets/` | ❌ (前端) |
| Lib Layer | `src/lib/` | ❌ (視需求) |
| Routes Layer | `src/routes/` | ❌ (有路由時) |

---

#### BUILD Phase 2: 標籤驗收 (The Enforcer)

```
輸入: 源碼檔案 + implementation plan
產物: GEMS 標籤合規 + checkpoint
指令: node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | BUILD Phase 2 | 標籤驗收通過 (覆蓋率: N%)
下一步: node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y --target=<path>
```

**@TASK 輸出 (emitTaskBlock 格式):**
```
═══════════════════════════════════════════════════════════
@BLOCKER | BUILD Phase 2 | 標籤不合規

@TASK
  ACTION: 修復 GEMS 標籤
  FILE: src/modules/xxx/services/yyy.ts
  EXPECTED: 加入完整 GEMS 標籤
  REFERENCE: .gems/iterations/iter-X/plan/implementation_plan_Story-X.Y.md

@NEXT_COMMAND
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y --target=<path>

@REMINDER
確保所有 @TASK 都已完成

@REPEAT-RULE (施工紅線)
🚫 禁止修改 task-pipe/ | ✅ 只能修改專案檔案
═══════════════════════════════════════════════════════════
```

**Gate 檢查項:**
| 檢查 | 說明 |
|------|------|
| UTF-8 編碼 | 無 BOM、無亂碼、無無效控制字元 (v2.3) |
| GEMS 基本標籤 | 每個函式有 GEMS 標籤 |
| P0/P1 擴展標籤 | FLOW, DEPS, TEST, TEST-FILE |
| 覆蓋率 | 基於 PLAN 定義的函式計算 (v2.2) |
| Plan 對比 | 標籤規格與 Plan 一致 |

**特殊:** 編碼問題 = BLOCKER，必須先修復

---

#### BUILD Phase 3: 測試腳本

```
輸入: 源碼檔案
產物: 測試檔案 + checkpoint
指令: node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | BUILD Phase 3 | 測試檔案: N | P0: N | P1: N | P2: N
[WARN] Integration 測試規範 (如有警告)
下一步: node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y --target=<path>
```

**@TEMPLATE_PENDING 輸出 (需建立測試):**
```
═══════════════════════════════════════════════════════════
@TEMPLATE_PENDING
═══════════════════════════════════════════════════════════
📁 目標檔案: src/modules/xxx/services/__tests__/

@GATE_SPEC
  ⏳ 測試檔案存在: *.test.ts
  ⏳ P0 測試覆蓋: Unit + Integration + E2E
  ⏳ P1 測試覆蓋: Unit + Integration
  ⏳ P2 測試覆蓋: Unit
  ⏳ 測試 import: import { fn } from

📝 需要填寫的項目:
  1. P0 函式: Unit + Integration + E2E 測試
  2. P1 函式: Unit + Integration 測試
  3. P2 函式: Unit 測試

✅ 填寫完成後執行: node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y
═══════════════════════════════════════════════════════════
```

**Gate 檢查項:**
| 檢查 | 說明 |
|------|------|
| 測試檔案存在 | `*.test.ts` |
| P0 覆蓋 | Unit + Integration + E2E |
| P1 覆蓋 | Unit + Integration |
| P2 覆蓋 | Unit |
| 測試 import | 必須 import 被測函式 |

---

#### BUILD Phase 4: Test Gate v3.0

```
輸入: 源碼 + 測試
產物: P0/P1 測試驗證 + checkpoint
指令: node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | BUILD Phase 4 | Test Gate 通過 (P0: N/N, P1: N/N)
下一步: node task-pipe/runner.cjs --phase=BUILD --step=5 --story=Story-X.Y --target=<path>
```

**@ERROR_SPEC 輸出:**
```
═══════════════════════════════════════════════════════════
@ERROR_SPEC
═══════════════════════════════════════════════════════════
📁 目標檔案: src/modules/xxx/services/__tests__/
❌ 缺少項目: P0 E2E 測試, P1 Integration 測試

@GATE_SPEC (本步驟驗證邏輯)
  ❌ GEMS-TEST-FILE 存在: 測試檔案路徑有效
  ✅ 測試 import 被測函式: import { fn }
  ❌ P0 有 E2E: *.e2e.test.ts
  ❌ P1 有 Integration: *.integration.test.ts
  ✅ GEMS-DEPS-RISK 正確: LOW|MEDIUM|HIGH

✅ 修復後執行: node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y
═══════════════════════════════════════════════════════════
```

**Gate 檢查項 (v3.0):**
| 檢查 | 說明 | Blocking |
|------|------|----------|
| GEMS-TEST-FILE 存在 | 測試檔案路徑有效 | ✅ |
| 測試 import 被測函式 | `import { fn }` | ✅ |
| P0 有 E2E | `*.e2e.test.ts` | ✅ (CRITICAL) |
| P1 有 Integration | `*.integration.test.ts` | ✅ (WARNING) |
| GEMS-DEPS-RISK 正確 | LOW/MEDIUM/HIGH | ✅ |
| 假整合測試偵測 | 過度 Mock | ✅ |

---

#### BUILD Phase 5: TDD 測試執行

```
輸入: 測試檔案
產物: 測試結果 + checkpoint + LOG
指令: node task-pipe/runner.cjs --phase=BUILD --step=5 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | BUILD Phase 5 | 測試全部通過 (N suites, N tests)
下一步: node task-pipe/runner.cjs --phase=BUILD --step=6 --story=Story-X.Y --target=<path>
```

**@TACTICAL_FIX 輸出 (測試失敗):**
```
@TACTICAL_FIX (1/3) | 測試失敗: N 個 suite 失敗
修復後: node task-pipe/runner.cjs --phase=BUILD --step=5 --story=Story-X.Y --target=<path>
詳情: .gems/iterations/iter-X/logs/build-phase-5-Story-X.Y-error-{timestamp}.log

@REPEAT-RULE (施工紅線)
🚫 禁止修改 task-pipe/ | ✅ 只能修改專案檔案
```

**特殊功能:**
- 測試環境偵測 (Jest/Vitest/Mocha)
- 環境安裝 HOOK (提供安裝指引)
- 每次執行都輸出 LOG（通過/失敗都有）

**Gate 檢查項:**
| 檢查 | 說明 |
|------|------|
| 測試框架安裝 | Jest/Vitest/Mocha |
| test script 配置 | package.json scripts.test |
| 測試全部通過 | npm test PASS |
| 禁止重寫邏輯 | 測試中不能重寫函式邏輯 |

---

#### BUILD Phase 6: 修改檔案測試驗證

```
輸入: 修改過的檔案
產物: 對應測試全部通過 + checkpoint
指令: node task-pipe/runner.cjs --phase=BUILD --step=6 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | BUILD Phase 6 | 修改檔案測試通過
下一步: node task-pipe/runner.cjs --phase=BUILD --step=7 --story=Story-X.Y --target=<path>
```

**Gate 檢查項:**
| 檢查 | 說明 |
|------|------|
| 修改檔案有測試 | GEMS-TEST-FILE 指定 |
| Integration 測試真實 | 禁止 mock 核心邏輯 |
| P0 有 E2E 覆蓋 | E2E 測試通過 |
| 測試全部通過 | npm test PASS |

**特殊:** 支援 `--pass` 參數 + 代碼質量驗證 (8 層核心驗證)

---

#### BUILD Phase 7: 整合檢查 v3.0

```
輸入: 完成的程式碼
產物: 整合項目確認 + checkpoint
指令: node task-pipe/runner.cjs --phase=BUILD --step=7 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | BUILD Phase 7 | 整合檢查通過
下一步: node task-pipe/runner.cjs --phase=BUILD --step=8 --story=Story-X.Y --target=<path>
```

**@ERROR_SPEC 輸出 (路由未整合 = BLOCKER):**
```
═══════════════════════════════════════════════════════════
@ERROR_SPEC
═══════════════════════════════════════════════════════════
📁 目標檔案: src/routes/ 或 src/modules/xxx/index.ts
❌ 缺少項目: 路由整合, 函式匯出

@GATE_SPEC
  ❌ 路由整合: Page 組件已 import + Route 定義 (BLOCKER)
  ❌ 函式匯出驗證: Story 新增函式已從 barrel export 匯出 (BLOCKER)
  ✅ 模組匯出: index.ts export
  ✅ package.json: scripts/deps 更新
  ✅ 依賴更新: npm install
  ⏳ UI Bind: @GEMS-UI-BIND 標籤 (Vanilla JS)

✅ 修復後執行: node task-pipe/runner.cjs --phase=BUILD --step=7 --story=Story-X.Y
═══════════════════════════════════════════════════════════
```

**Gate 檢查項 (v3.0):**
| 檢查 | 說明 | Blocking |
|------|------|----------|
| 路由整合 | Page 組件 import + Route 定義 | ✅ BLOCKER |
| 函式匯出驗證 | barrel export | ✅ BLOCKER |
| 模組匯出 | index.ts export | ❌ |
| package.json | scripts/deps 更新 | ❌ |
| 依賴更新 | npm install | ❌ |
| UI Bind (v4.1) | @GEMS-UI-BIND (Vanilla JS) | ❌ |

**注意:** 路由未整合 / 函式未匯出 = BLOCKER，禁止 `--pass` 跳過

---

#### BUILD Phase 8: 完成規格 (Fillback)

```
輸入: 完成的程式碼
產物: Fillback_Story-X.Y.md + iteration_suggestions_Story-X.Y.json
指令: node task-pipe/runner.cjs --phase=BUILD --step=8 --story=Story-X.Y --target=<path>
```

**@PASS 輸出:**
```
@PASS | BUILD Phase 8 | Fillback 完成
下一步: node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.{Y+1} --target=<path>
  (或) 下一步: node task-pipe/runner.cjs --phase=SCAN --target=<path>
```

**@TEMPLATE_PENDING 輸出 (需建立 Fillback):**
```
═══════════════════════════════════════════════════════════
@TEMPLATE_PENDING
═══════════════════════════════════════════════════════════
📁 目標檔案: .gems/iterations/iter-X/build/

@GATE_SPEC
  ⏳ Fillback 檔案: Fillback_Story-X.Y.md
  ⏳ Suggestions 檔案: iteration_suggestions_Story-X.Y.json
  ⏳ storyId 欄位: "storyId": "Story-X.Y"
  ⏳ status 欄位: "status": "Completed"
  ⏳ 入口點: index.html + main.ts
  ⏳ npm scripts: dev/start script
  ⏳ bundler: vite/webpack

📝 需要填寫的項目:
  1. Fillback_Story-X.Y.md
  2. iteration_suggestions_Story-X.Y.json

✅ 填寫完成後執行: node task-pipe/runner.cjs --phase=BUILD --step=8 --story=Story-X.Y
═══════════════════════════════════════════════════════════
```

**Gate 檢查項:**
| 檢查 | 說明 | 嚴格度 |
|------|------|--------|
| Fillback 檔案 | `Fillback_Story-X.Y.md` | 必填 |
| Suggestions 檔案 | `iteration_suggestions_Story-X.Y.json` | 必填 |
| storyId 欄位 | `"storyId": "Story-X.Y"` | 必填 |
| status 欄位 | `"status": "Completed"` | 必填 |
| suggestions[] | 建議陣列 | 選填 (警告) |
| technicalDebt[] | 技術債 | 選填 (警告) |
| summary | 摘要 | 選填 (警告) |
| 入口點 | index.html + main.ts | 環境可執行性 |
| npm scripts | dev/start script | 環境可執行性 |
| bundler | vite/webpack | 環境可執行性 |


---

### ═══════════════════════════════════════
### SCAN 階段
### ═══════════════════════════════════════

#### SCAN: 規格書產出

```
輸入: 完成的專案
產物: system-blueprint.json, functions.json, schema.json, tech-stack.json
指令: node task-pipe/runner.cjs --phase=SCAN --target=<path>
```

**@PASS 輸出:**
```
@PASS | SCAN | 規格書產出完成
下一步: 進入下一個 iteration 或完成
```

**@CONTEXT 輸出:**
```
@CONTEXT
Phase SCAN | 規格書產出 | iter-X

@INFO
  Scanner: gems-full-scanner.cjs
  源碼: src/
  產出: .gems/docs/
```

**產出檔案:**
| 檔案 | 說明 |
|------|------|
| `.gems/docs/system-blueprint.json` | 整合藍圖 |
| `.gems/docs/functions.json` | 函式清單 (含 specPurpose) |
| `.gems/docs/schema.json` | 資料庫結構 |
| `.gems/docs/tech-stack.json` | 技術棧 |
| `.gems/backups/` | iteration 備份 |

---

## 🔴 路線 A: Blueprint Flow (Gate → draft-to-plan → BUILD → Shrink → Expand → Verify)

### ═══════════════════════════════════════
### Blueprint 工具 (sdid-tools/)
### ═══════════════════════════════════════

> Blueprint Flow 使用獨立的 `sdid-tools/lib/log-output.cjs`，API 與 task-pipe 一致。
> 施工紅線: `🚫 禁止修改 task-pipe/ 和 sdid-tools/ | ✅ 只能修改專案檔案`

---

#### Blueprint Gate v1.2: 活藍圖品質門控

```
輸入: Enhanced Draft v2 (活藍圖 .md)
產物: 品質報告
指令: node sdid-tools/blueprint-gate.cjs --draft=<path> [--iter=1] [--level=M] [--target=<project>]
Log 前綴: gate-check-
```

**@PASS 輸出:**
```
@PASS | gate-check | 藍圖品質合格，可進入 draft-to-plan
下一步: node sdid-tools/draft-to-plan.cjs --draft=<path> --iter=N --target=<project>
```

**@BLOCKER 輸出:**
```
@BLOCKER | gate-check | 藍圖有 N 個結構性問題
修復後: node sdid-tools/blueprint-gate.cjs --draft=<path> --iter=N
詳情: .gems/iterations/iter-X/logs/gate-check-error-{timestamp}.log

@REPEAT-RULE (施工紅線)
🚫 禁止修改 task-pipe/ 和 sdid-tools/ | ✅ 只能修改專案檔案
```

**@WARN 輸出:**
```
@WARN | gate-check | 藍圖有 N 個建議改善項目（不阻擋）
下一步: node sdid-tools/draft-to-plan.cjs --draft=<path> --iter=N --target=<project>
```

**Gate 檢查項 (v1.2):**
| # | 檢查 | Level | 說明 |
|---|------|-------|------|
| FMT-001 | 一句話目標 | BLOCKER | 長度 ≥ 10 字 |
| FMT-002 | 用戶原始需求 | WARN | 建議 50 字以上 |
| FMT-003 | 族群識別 | WARN | 表格存在 |
| FMT-004 | 實體定義 | WARN | Entity Tables |
| FMT-005 | 獨立模組 | BLOCKER/WARN | iter-2+ 可接受 WARN |
| FMT-006 | 迭代規劃表 | BLOCKER | 必須存在 |
| FMT-007 | 模組動作清單 | BLOCKER | 必須存在 |
| — | 佔位符偵測 | BLOCKER | `{placeholder}` 未替換 |
| — | 標籤完整性 | BLOCKER | GEMS 標籤格式 |
| — | 依賴無循環 | BLOCKER | DAG 驗證 |
| — | 迭代 DAG | BLOCKER | iter 順序正確 |
| — | Stub 最低資訊 | WARN | Stub 有基本描述 |
| — | 草稿狀態 | WARN | v1.1 新增 |
| — | 依賴一致性 | BLOCKER | v1.1 新增 |
| — | 迭代負載 | BLOCKER | v1.1 Level 限制 |
| — | 公開 API↔動作清單 | BLOCKER | v1.2 新增 |
| — | Flow 精確度 | WARN | v1.2 新增 |
| — | API 簽名完整性 | BLOCKER | v1.2 新增 |

---

#### Draft-to-Plan v1.0: 藍圖→執行計畫

```
輸入: 活藍圖 (Gate @PASS 後)
產物: implementation_plan_Story-N.Y.md (per Story)
指令: node sdid-tools/draft-to-plan.cjs --draft=<path> --iter=N --target=<project>
Log 前綴: gate-plan-
```

**@PASS 輸出:**
```
@PASS | gate-plan | 已產出 N 個 Plan 檔案
下一步: node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-N.0 --target=<project>
```

**@BLOCKER 輸出:**
```
@BLOCKER | gate-plan | 轉換失敗
修復後: node sdid-tools/draft-to-plan.cjs --draft=<path> --iter=N --target=<project>
詳情: .gems/iterations/iter-X/logs/gate-plan-error-{timestamp}.log
```

**產出檔案:**
```
.gems/iterations/iter-N/plan/
  ├── implementation_plan_Story-N.0.md  (基礎建設)
  ├── implementation_plan_Story-N.1.md  (功能模組 1)
  ├── implementation_plan_Story-N.2.md  (功能模組 2)
  └── ...
```

**自動推導:**
| 欄位 | 推導邏輯 |
|------|---------|
| GEMS-DEPS-RISK | deps 中 Module/Internal 數量 → LOW/MEDIUM/HIGH |
| GEMS-TEST | P0: ✓U✓I✓E / P1: ✓U✓I / P2: ✓U / P3: ✓U |
| GEMS-TEST-FILE | techName → kebab-case.test.ts |
| 檔案路徑 | type + moduleName → `src/modules/{mod}/services/{name}.ts` |
| [STEP] 錨點 | flow 字串 → `// [STEP] Step1` |

---

#### Blueprint Shrink v1.0: 活藍圖收縮器

```
輸入: 活藍圖 + iter 完成的 Fillback
產物: 更新後的活藍圖 (已完成動作 → [DONE] 一行摘要)
指令: node sdid-tools/blueprint-shrink.cjs --draft=<path> --iter=N --target=<project>
Log 前綴: gate-shrink-
```

**@PASS 輸出:**
```
@PASS | gate-shrink | 收縮完成，N 個模組已折疊
下一步: node sdid-tools/blueprint-expand.cjs --draft=<path> --iter={N+1} --target=<project>
  (或) node sdid-tools/blueprint-verify.cjs --draft=<path> --target=<project> --iter=N
```

**@BLOCKER 輸出:**
```
@BLOCKER | gate-shrink | 收縮失敗
修復後: node sdid-tools/blueprint-shrink.cjs --draft=<path> --iter=N --target=<project>
詳情: .gems/iterations/iter-X/logs/gate-shrink-error-{timestamp}.log
```

**行為:**
- 讀取 `.gems/iterations/iter-N/build/iteration_suggestions_*.json`
- 已完成動作清單 → `[DONE] 一行摘要`
- Fillback suggestions → 附加到下一個 Stub 備註
- 收集統計: Priority 分佈、完成數、Evolution 層

---

#### Blueprint Expand v1.0: Stub 展開器

```
輸入: 活藍圖 (Shrink 後) + 前一 iter 的 Fillback
產物: 更新後的活藍圖 (Stub → Full 動作清單骨架)
指令: node sdid-tools/blueprint-expand.cjs --draft=<path> --iter=N --target=<project>
Log 前綴: gate-expand-
```

**@PASS 輸出:**
```
@PASS | gate-expand | 展開完成，N 個 Stub 已展開
下一步: node sdid-tools/blueprint-gate.cjs --draft=<path> --iter=N --target=<project>
```

**@BLOCKER 輸出:**
```
@BLOCKER | gate-expand | 展開失敗
修復後: node sdid-tools/blueprint-expand.cjs --draft=<path> --iter=N --target=<project>
詳情: .gems/iterations/iter-X/logs/gate-expand-error-{timestamp}.log
```

**展開來源:**
| 來源 | 說明 |
|------|------|
| Fillback suggestions | 前一 iter 的建議 |
| 公開 API | 模組定義的 API 簽名 |
| 模組定義 | 依賴關係推導 |

**自動推導:**
| 欄位 | 推導邏輯 |
|------|---------|
| Priority | mutation → P0, query → P1 |
| Flow | mutation → VALIDATE→PROCESS→PERSIST→RETURN |
| Deps | 從模組依賴推導 |

---

#### Blueprint Verify v1.0: 藍圖↔源碼 雙向語意比對

```
輸入: 活藍圖 + functions.json (SCAN 產出)
產物: blueprint-verify.json + BLUEPRINT_VERIFY.md
指令: node sdid-tools/blueprint-verify.cjs --draft=<path> --target=<project> --iter=N
Log 前綴: gate-verify-
```

**@PASS 輸出:**
```
@PASS | gate-verify | 藍圖↔源碼一致
下一步: 完成！或進入下一個 iteration
```

**@BLOCKER 輸出:**
```
@BLOCKER | gate-verify | 發現 N 個語意差異
修復後: node sdid-tools/blueprint-verify.cjs --draft=<path> --target=<project> --iter=N
詳情: .gems/iterations/iter-X/logs/gate-verify-error-{timestamp}.log
```

**比對邏輯:**
| 差異類型 | 說明 |
|---------|------|
| 藍圖有、源碼沒有 | 該實作但未實作 |
| 源碼有、藍圖沒有 | 未在藍圖中定義 |
| 名稱模糊比對 | normalize: 移除 `-_`，轉小寫 |

**產出檔案:**
```
.gems/docs/
  ├── blueprint-verify.json   (結構化差異)
  └── BLUEPRINT_VERIFY.md     (人類可讀報告)
```


---

## 🔄 流程對齊比較表

### Task-Pipe Flow vs Blueprint Flow

| 階段 | Task-Pipe Flow | Blueprint Flow | 共用? |
|------|---------------|----------------|-------|
| 需求輸入 | `requirement_draft_iter-X.md` | Enhanced Draft v2 (活藍圖) | ❌ |
| 品質門控 | POC Step 1-5 | `blueprint-gate.cjs` | ❌ |
| 計畫產出 | PLAN Step 1-5 | `draft-to-plan.cjs` | ❌ |
| 開發執行 | BUILD Phase 1-8 | BUILD Phase 1-8 | ✅ 共用 runner.cjs |
| 規格回填 | SCAN | `blueprint-shrink.cjs` | ❌ |
| 下一迭代 | 手動建立 iter-N+1 | `blueprint-expand.cjs` | ❌ |
| 最終驗證 | SCAN 報告 | `blueprint-verify.cjs` | ❌ |

### 錯誤處理對齊

| 機制 | Task-Pipe | Blueprint | 說明 |
|------|-----------|-----------|------|
| 成功標記 | `@PASS` | `@PASS` | 相同 |
| 錯誤標記 | `@TACTICAL_FIX` / `@BLOCKER` | `@BLOCKER` | Task-Pipe 有分級 |
| 精準錯誤 | `@ERROR_SPEC` | `@BLOCKER` + log | Task-Pipe 更精準 |
| 模板填寫 | `@TEMPLATE_PENDING` | N/A | 僅 Task-Pipe |
| 任務區塊 | `@TASK` + `@NEXT_COMMAND` | N/A | 僅 Task-Pipe |
| 施工紅線 | `@FORBIDDEN` + `@REPEAT-RULE` | `@REPEAT-RULE` | 相同概念 |
| 策略漂移 | 3 級 (TACTICAL→STRATEGY→PLAN) | N/A | 僅 Task-Pipe |
| 染色分析 | `@TAINT_ANALYSIS` | N/A | 僅 Task-Pipe |
| Log 存檔 | `.gems/iterations/iter-X/logs/` | `.gems/iterations/iter-X/logs/` | ✅ 共用目錄 |

### Log 前綴對齊

| 工具 | Log 前綴 | 範例 |
|------|---------|------|
| POC Step 1 | `poc-step-1-` | `poc-step-1-error-2026-02-14T...log` |
| POC Step 2 | `poc-step-2-` | `poc-step-2-error-2026-02-14T...log` |
| POC Step 3 | `poc-step-3-` | `poc-step-3-error-2026-02-14T...log` |
| POC Step 4 | `poc-step-4-` | `poc-step-4-error-2026-02-14T...log` |
| POC Step 5 | `poc-step-5-` | `poc-step-5-error-2026-02-14T...log` |
| PLAN Step 1 | `plan-step-1-` | `plan-step-1-Story-1.0-error-...log` |
| PLAN Step 2 | `plan-step-2-` | `plan-step-2-Story-1.0-template-...log` |
| PLAN Step 3 | `plan-step-3-` | `plan-step-3-Story-1.0-error-...log` |
| PLAN Step 4 | `plan-step-4-` | `plan-step-4-Story-1.0-error-...log` |
| PLAN Step 5 | `plan-step-5-` | `plan-step-5-Story-1.0-error-...log` |
| BUILD Phase 1 | `build-phase-1-` | `build-phase-1-Story-1.0-template-...log` |
| BUILD Phase 2 | `build-phase-2-` | `build-phase-2-Story-1.0-error-...log` |
| BUILD Phase 3 | `build-phase-3-` | `build-phase-3-Story-1.0-template-...log` |
| BUILD Phase 4 | `build-phase-4-` | `build-phase-4-Story-1.0-error-...log` |
| BUILD Phase 5 | `build-phase-5-` | `build-phase-5-Story-1.0-error-...log` |
| BUILD Phase 6 | `build-phase-6-` | `build-phase-6-Story-1.0-error-...log` |
| BUILD Phase 7 | `build-phase-7-` | `build-phase-7-Story-1.0-error-...log` |
| BUILD Phase 8 | `build-phase-8-` | `build-phase-8-Story-1.0-template-...log` |
| SCAN | `scan-scan-` | `scan-scan-pass-2026-02-14T...log` |
| Blueprint Gate | `gate-check-` | `gate-check-error-2026-02-14T...log` |
| Draft-to-Plan | `gate-plan-` | `gate-plan-pass-2026-02-14T...log` |
| Blueprint Shrink | `gate-shrink-` | `gate-shrink-pass-2026-02-14T...log` |
| Blueprint Expand | `gate-expand-` | `gate-expand-pass-2026-02-14T...log` |
| Blueprint Verify | `gate-verify-` | `gate-verify-pass-2026-02-14T...log` |

---

## 🚨 錯誤處理機制 (三層策略漂移)

### 策略漂移等級

| Level | 重試次數 | 策略名稱 | 輸出標記 | 行動 |
|-------|---------|---------|---------|------|
| 1 | 1-3 次 | TACTICAL_FIX | `@TACTICAL_FIX` | 局部修補，在原檔案修復 |
| 2 | 4-6 次 | STRATEGY_SHIFT | `@STRATEGY_SHIFT` | 換個方式實作，考慮重構 |
| 3 | 7+ 次 | PLAN_ROLLBACK | `@PLAN_ROLLBACK` | 質疑架構，回退 PLAN 階段 |

### 優先級重試上限

| Priority | 最大重試 | 升級門檻 | 輸出 |
|----------|---------|---------|------|
| P0 | 10 次 | 第 4 次升級 | `@TACTICAL_FIX (4/10)` |
| P1 | 8 次 | 第 3 次升級 | `@TACTICAL_FIX (3/8)` |
| P2 | 5 次 | 第 2 次升級 | `@TACTICAL_FIX (2/5)` |
| P3 | 3 次 | 第 2 次升級 | `@TACTICAL_FIX (2/3)` |

### 超限升級輸出

```
@ARCHITECTURE_REVIEW | {Phase} {Step} 需要進一步完善 (N/N)
修復後: 建議：架構師協作，確認完成狀態
詳情: .gems/iterations/iter-X/logs/{phase}-{step}-error-{timestamp}.log
```

### 策略漂移輸出 (v2.0)

```
@STRATEGY_DRIFT
Level: 2/3 (STRATEGY_SHIFT)
Action: 換個方式實作
Guidance: {具體建議}
  - 考慮重構 xxx
  - 嘗試不同的實作方式

@TAINT_ANALYSIS | 修改 N 個函式 → 影響 N 個依賴者
  受影響檔案: src/xxx.ts, src/yyy.ts...

@INCREMENTAL_HINT | 建議驗證範圍:
  - 標籤驗證: 檢查受影響檔案的 GEMS 標籤
  - 測試驗證: 跑受影響檔案的測試
  - 整合驗證: 檢查 import/export 是否正常
```

### 遞迴回溯

| 失敗類型 | 回溯目標 | 輸出 |
|---------|---------|------|
| 標籤缺失 | BUILD Phase 2 | `回溯: BUILD Phase 2` |
| 測試失敗 | BUILD Phase 3-5 | `回溯: BUILD Phase 3` |
| 整合失敗 | BUILD Phase 6-7 | `回溯: BUILD Phase 6` |
| 架構問題 | PLAN Step 2-3 | `回溯: PLAN Step 2` |

---

## 📐 輸出函式 API 對照

### task-pipe/lib/shared/log-output.cjs

| 函式 | 用途 | 輸出標記 |
|------|------|---------|
| `anchorPass(phase, step, summary, nextCmd, opts)` | 成功 | `@PASS` |
| `anchorError(type, summary, nextCmd, opts)` | 錯誤 | `@TACTICAL_FIX` / `@BLOCKER` / `@ARCHITECTURE_REVIEW` |
| `anchorErrorSpec(spec, opts)` | 精準錯誤 | `@ERROR_SPEC` + `@GATE_SPEC` + `@FORBIDDEN` |
| `anchorTemplatePending(spec, opts)` | 模板填寫 | `@TEMPLATE_PENDING` + `@GATE_SPEC` + `@FORBIDDEN` |
| `anchorOutput(sections, opts)` | 完整輸出 | `@CONTEXT` + `@INFO` + `@GUIDE` + `@RULES` + `@TASK` + `@TEMPLATE` + `@OUTPUT` |
| `emitTaskBlock(spec, opts)` | 指令式任務 | `@TASK` + `@NEXT_COMMAND` + `@REMINDER` |
| `outputPass(nextCmd, summary)` | 精簡成功 | `@PASS` |
| `outputError(opts)` | 精簡錯誤 | `@TACTICAL_FIX` / `@BLOCKER` |
| `outputTemplate(opts)` | 模板存檔 | `@TEMPLATE` |
| `saveLog(opts)` | 存檔 | 回傳相對路徑 |

### sdid-tools/lib/log-output.cjs

| 函式 | 用途 | 輸出標記 |
|------|------|---------|
| `anchorPass(phase, step, summary, nextCmd, opts)` | 成功 | `@PASS` |
| `anchorError(type, summary, nextCmd, opts)` | 錯誤 | `@BLOCKER` + `@REPEAT-RULE` |
| `anchorOutput(sections, opts)` | 完整輸出 | 同 task-pipe API |
| `saveLog(opts)` | 存檔 | 回傳相對路徑 |

---

## 🔑 Blueprint Flow 黃金法則

> BUILD Phase 8 的「下一步: SCAN」指令在 Blueprint Flow 中必須忽略。
> 永遠透過 `loop.cjs` 執行下一步。

| BUILD 輸出 | Blueprint Flow 正確行為 |
|-----------|----------------------|
| `下一步: BUILD --step=N` | ✅ 正確，繼續下一個 Phase |
| `下一步: SCAN` | ❌ 忽略！重新執行 `loop.cjs` |
| BUILD Phase 8 @PASS | 重新執行 `loop.cjs`（自動偵測下一個 Story 或 SHRINK） |

---

## 📋 完整循環圖

### Task-Pipe Flow
```
POC Step 1 (@PASS) → Step 2 (@PASS) → Step 3 (@PASS) → Step 4 (@PASS) → Step 5 (@PASS)
  ↓
PLAN Step 1 (@PASS) → Step 2 (@PASS) → Step 3 (@PASS) → Step 4 (@PASS) → Step 5 (@PASS)
  ↓
BUILD Phase 1 (@PASS) → Phase 2 (@PASS) → Phase 3 (@PASS) → Phase 4 (@PASS)
  → Phase 5 (@PASS) → Phase 6 (@PASS) → Phase 7 (@PASS) → Phase 8 (@PASS)
  ↓ (下一個 Story)
BUILD Phase 1 → ... → Phase 8 (@PASS)
  ↓ (所有 Story 完成)
SCAN (@PASS) → 完成 (或進入下一個 iteration)
```

### Blueprint Flow
```
Gate (@PASS) → draft-to-plan (@PASS)
  ↓
BUILD Phase 1-8 (Story-N.0) → BUILD Phase 1-8 (Story-N.1) → ...
  ↓ (所有 Story 完成)
Shrink (@PASS)
  ↓ (如果有下一個 iter)
Expand (@PASS) → Gate (@PASS) → draft-to-plan (@PASS) → BUILD → Shrink → ...
  ↓ (最後)
Verify (@PASS) → 完成
```
