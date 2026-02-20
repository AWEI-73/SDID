# GEMS Task-Pipe 完整指南

**版本**: v2.1  
**更新日期**: 2026-01-06  
**狀態**: ✅ 穩定

---

## 目錄

1. [整體架構](#1-整體架構)
2. [POC 階段](#2-poc-階段)
3. [PLAN 階段](#3-plan-階段)
4. [BUILD 階段](#4-build-階段)
5. [SCAN 階段](#5-scan-階段)
6. [錯誤處理機制](#6-錯誤處理機制)
7. [軍規總覽](#7-軍規總覽)
8. [檔案命名與路徑約定](#8-檔案命名與路徑約定)
9. [一致性審查報告](#9-一致性審查報告)
10. [快速參考](#10-快速參考)

---

## 1. 整體架構

### 1.1 流程總覽

```
CEO 需求 → POC → PLAN → BUILD → SCAN → 下一個 Iteration
```

```
┌─────────────────────────────────────────────────────────────────┐
│                        GEMS 流程總覽                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CEO 需求                                                       │
│      ↓                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  POC (可選)                                              │   │
│  │  Step 0 → 0.5 → 1 → 2 → 3                               │   │
│  │  產出: requirement_spec + Contract + POC.html           │   │
│  └─────────────────────────────────────────────────────────┘   │
│      ↓                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PLAN                                                    │   │
│  │  Step 1 → 2 → 2.5 → 2.6 → 3                             │   │
│  │  產出: implementation_plan_Story-X.Y.md                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│      ↓                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  BUILD (每個 Story)                                      │   │
│  │  Phase 1 → 2 → 3 → 4 → 5 → 6 → 6.5 → 7                  │   │
│  │  產出: Code + Fillback + iteration_suggestions.json    │   │
│  └─────────────────────────────────────────────────────────┘   │
│      ↓                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  SCAN                                                    │   │
│  │  全專案掃描，驗證標籤 + 規格一致性                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│      ↓                                                          │
│  下一個 Iteration                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 錨點系統

所有 Phase 腳本輸出使用統一錨點：

| 錨點 | 用途 |
|------|------|
| `@CONTEXT` | 狀態摘要（目前在哪、檢查結果） |
| `@RULES (軍規)` | 適用的軍規 |
| `@TASK` | 任務指示（要做什麼） |
| `@TEMPLATE` | 可複製模板 |
| `@OUTPUT` | 結果與下一步指令 |

### 1.3 Task-Pipe 目錄結構

```
task-pipe/
├── runner.cjs                    # 主入口
├── config.json                   # Hub 配置
├── MASTER_PLAN.md                # 開發計劃
├── GUIDE.md                      # 本文件
│
├── lib/
│   ├── checkpoint.cjs            # Checkpoint 管理
│   ├── error-handler.cjs         # 錯誤處理（TACTICAL_FIX）
│   ├── suggestions-validator.cjs # Suggestions 驗證
│   ├── gems-validator.cjs        # GEMS 標籤驗證
│   └── plan-spec-extractor.cjs   # Plan 解析
│
├── state/
│   └── state-manager.cjs         # 狀態持久化
│
└── phases/
    ├── poc/                      # POC 階段
    │   ├── step-0.cjs            # 模糊消除
    │   ├── step-0.5.cjs          # 環境檢查
    │   ├── step-1.cjs            # 契約設計
    │   ├── step-2.cjs            # UI 原型
    │   └── step-3.cjs            # 需求規格
    │
    ├── plan/                     # PLAN 階段
    │   ├── step-1.cjs            # 需求確認
    │   ├── step-2.cjs            # 規格注入
    │   ├── step-2.5.cjs          # 架構審查
    │   ├── step-2.6.cjs          # 標籤規格設計
    │   └── step-3.cjs            # 需求規格說明
    │
    └── build/                    # BUILD 階段
        ├── phase-1.cjs           # 開發腳本
        ├── phase-2.cjs           # 測試腳本
        ├── phase-3.cjs           # TDD 測試
        ├── phase-4.cjs           # 標籤驗收
        ├── phase-5.cjs           # TDD 執行
        ├── phase-6.cjs           # 修改檔案測試
        ├── phase-7.cjs           # 整合檢查
        └── phase-8.cjs           # 完成規格
```

---

## 2. POC 階段

### 2.1 目的

消除模糊、定義契約、產出可視化原型

### 2.2 步驟詳情

| Step | 名稱 | 輸入 | 產物 | 驗證 |
|------|------|------|------|------|
| **0** | 模糊消除 | 用戶原始需求 | `requirement_draft_iter-X.md` | 所有模糊點已列出 |
| **0.5** | 環境檢查 | draft | 更新 draft（加入 POC 模式） | 已選擇 HTML/TSX |
| **1** | 契約設計 | draft | `xxxContract.ts` | 有 @GEMS-CONTRACT、@GEMS-TABLE |
| **2** | UI 原型 | draft + Contract | `xxxPOC.html` | 可雙擊運行、有視覺效果 |
| **3** | 需求規格 | draft + Contract + POC | `requirement_spec_iter-X.md` | 有用戶故事、驗收標準 |

### 2.3 執行指令

```bash
node task-pipe/runner.cjs --phase=POC --step=0 --target=./my-project
node task-pipe/runner.cjs --phase=POC --step=0.5 --target=./my-project
node task-pipe/runner.cjs --phase=POC --step=1 --target=./my-project
node task-pipe/runner.cjs --phase=POC --step=2 --target=./my-project
node task-pipe/runner.cjs --phase=POC --step=3 --target=./my-project
```

### 2.4 產出位置

```
.gems/iterations/iter-1/poc/
├── requirement_draft_iter-1.md      # Step 0 產出
├── requirement_spec_iter-1.md       # Step 3 產出（最終）
├── CalculatorContract.ts            # Step 1 產出
└── CalculatorPOC.html               # Step 2 產出
```

### 2.5 POC 軍規

| 軍規 | 說明 | 強制程度 |
|------|------|----------|
| 禁止腦補 | 模糊需求必須先提出 [NEEDS CLARIFICATION] | blocking |
| 強制視覺驗證 | POC 必須可直接運行並展示視覺效果 | blocking |
| 契約先行 | @GEMS-CONTRACT 必須包含 DB 型別註解 | blocking |
| 無真實 API | POC 禁止真實 fetch 調用，只使用 MOCK_DATA | blocking |
| 行數無上限 | HTML POC 行數無限制，工具會自動壓縮 | recommended |

---

## 3. PLAN 階段

### 3.1 目的

將需求規格拆成可執行的 Implementation Plan

### 3.2 步驟詳情

| Step | 名稱 | 輸入 | 產物 | 驗證 |
|------|------|------|------|------|
| **1** | 需求確認 | POC 產出 / CEO 需求 | 需求摘要 | 目標模組已識別 |
| **2** | 規格注入 | Contract + Spec | 規格注入結果 | 有 @GEMS-CONTRACT/@GEMS-UI |
| **2.5** | 架構審查 | 規格 | 審查報告 | 複雜度/封裝檢核通過 |
| **2.6** | 標籤規格設計 | 規格 | 標籤模板 | 每個 Item 有 GEMS 標籤模板 |
| **3** | 需求規格說明 | 所有輸入 | `implementation_plan_Story-X.Y.md` | 有 Items、明確度標註 |

### 3.3 執行指令

```bash
node task-pipe/runner.cjs --phase=PLAN --step=1 --story=Story-1.0 --target=./my-project
node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-1.0 --target=./my-project
node task-pipe/runner.cjs --phase=PLAN --step=2.5 --story=Story-1.0 --target=./my-project
node task-pipe/runner.cjs --phase=PLAN --step=2.6 --story=Story-1.0 --target=./my-project
node task-pipe/runner.cjs --phase=PLAN --step=3 --story=Story-1.0 --target=./my-project
```

### 3.4 產出位置

```
.gems/iterations/iter-1/plan/
└── implementation_plan_Story-1.0.md
```

### 3.5 PLAN 軍規

| 軍規 | 說明 | 強制程度 |
|------|------|----------|
| 不跳步 | 必須依序執行 Step 1 → 2 → 2.5 → 2.6 → 3 | blocking |
| 一次一個模組 | 每次 PLAN 只規劃一個模組 | blocking |
| POC 先行 | 先定義 @GEMS-CONTRACT 資料契約 | blocking |
| 明確度判定 | 每個 Item 必須標註「明確」或「需驗證」 | blocking |
| 需驗證就加 Phase 0 | 標註為「需驗證」的 Item 必須有 Phase 0 | blocking |

---

## 4. BUILD 階段

### 4.1 目的

實作程式碼、撰寫測試、驗證標籤、產出完成報告

### 4.2 步驟詳情

| Phase | 名稱 | 做什麼 | 驗證條件 | 錯誤處理 |
|-------|------|--------|----------|----------|
| **1** | 開發腳本 | 讀取 Plan，寫功能程式碼，加 GEMS 標籤 | `getDiagnostics() = 0` | BLOCKER |
| **2** | 測試腳本 | 依風險等級撰寫測試 (P0/P1/P2/P3) | `getDiagnostics() = 0` | BLOCKER |
| **3** | TDD 測試 | 執行 `npm test` | `passRate === 100%` | TACTICAL_FIX |
| **4** | 標籤驗收 | 驗證 GEMS 標籤完整性 | `coverage >= 80%` | TACTICAL_FIX |
| **5** | Test Gate | 驗證測試檔案存在、import 正確 | P0/P1 測試 100% | TACTICAL_FIX |
| **6** | 修改檔案測試 | 確保修改不破壞現有功能 | 所有測試通過 | TACTICAL_FIX |
| **6.5** | 整合檢查 | 檢查 package.json/routes/exports | Checklist 完成 | PENDING |
| **7** | 完成規格 | 產出 Fillback + Suggestions | 必填欄位驗證 | TACTICAL_FIX |

### 4.3 執行指令

```bash
# 完整流程 (Level M)
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --target=./my-project
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-1.0 --target=./my-project
node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0 --target=./my-project
node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-1.0 --target=./my-project
node task-pipe/runner.cjs --phase=BUILD --step=5 --story=Story-1.0 --target=./my-project
node task-pipe/runner.cjs --phase=BUILD --step=6 --story=Story-1.0 --target=./my-project
node task-pipe/runner.cjs --phase=BUILD --step=7 --story=Story-1.0 --target=./my-project
node task-pipe/runner.cjs --phase=BUILD --step=8 --story=Story-1.0 --target=./my-project

# 快速模式 (Level S，跳過測試)
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --level=S --target=./my-project
# Phase 1 完成後直接跳到 Phase 4
```

### 4.4 產出位置

```
.gems/iterations/iter-1/build/
├── Fillback_Story-1.0.md                    # 開發 Log
├── iteration_suggestions_Story-1.0.json     # 迭代建議
└── checkpoint_Story-1.0_phase-X.json        # 中間產物（完成後清除）
```

### 4.5 錨點格式一致性

| Phase | @CONTEXT | @RULES | @TASK | @TEMPLATE | @OUTPUT |
|-------|----------|--------|-------|-----------|---------|
| 1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 | ✅ | ✅ | ✅ | ❌ (合理) | ✅ |
| 4 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6 | ✅ | ✅ | ✅ | ❌ (合理) | ✅ |
| 6.5 | ✅ | ✅ | ✅ | ❌ (合理) | ✅ |
| 7 | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.6 錯誤處理機制

| Phase | error-handler | TACTICAL_FIX | BLOCKER |
|-------|---------------|--------------|---------|
| 1 | ❌ | ❌ | ✅ 硬性 |
| 2 | ❌ | ❌ | ✅ 硬性 |
| 3 | ✅ | ✅ 3 層恢復 | ✅ |
| 4 | ✅ | ✅ 3 層恢復 | ✅ |
| 5 | ✅ | ✅ 3 層恢復 | ✅ |
| 6 | ✅ | ✅ 3 層恢復 | ✅ |
| 6.5 | ❌ | ❌ | ❌ |
| 7 | ✅ | ✅ 嚴格/寬鬆分級 | ✅ |

> Phase 1/2 是「產出」階段，不需要錯誤恢復機制  
> Phase 6.5 是 Checklist 提醒，人工決定

### 4.7 驗證分級（Phase 7 Suggestions）

| 類型 | 欄位 | 說明 |
|------|------|------|
| 🔴 **嚴格必填** | `storyId`, `status` | 缺了就 TACTICAL_FIX |
| 🟢 **寬鬆選填** | `suggestions[]`, `technicalDebt[]`, `summary` | 只給警告，不擋 |

### 4.8 BUILD 軍規

| # | 軍規 | 說明 | 強制程度 |
|---|------|------|----------|
| 0 | 一個 Agent 一個 Story | 避免 context 過長卡死 | blocking |
| 1 | 開發腳本先行 | 型別檢查 0 errors 才進測試 | blocking |
| 2 | 測試依風險 | P0:U+I+E2E, P1:U+I, P2:U, P3:手動 | blocking |
| 3 | TDD 100% | 禁止在測試中重寫函式邏輯 | blocking |
| 4 | 標籤驗收 | 所有函式有 GEMS 標籤，P0/P1 有擴展標籤 | blocking |
| 5 | 小跑修正 | SEARCH→修正→重試，最多 3 次 | blocking |
| 6 | 修改檔案必須測試 | 跳過測試 = BUILD 無效 | blocking |
| 7 | 完整執行 | 不可中途結束 Phase 1-7 | blocking |
| 8 | 完成後詢問 | 不自動開始下一個 Story | blocking |

---

## 5. SCAN 階段

### 5.1 目的

全專案掃描，驗證 GEMS 標籤完整性和規格一致性

### 5.2 預期功能

| 檢查項目 | 做什麼 |
|----------|--------|
| **標籤完整性** | 所有函式都有 GEMS 標籤 |
| **P0/P1 擴展標籤** | GEMS-FLOW, GEMS-DEPS, GEMS-TEST, GEMS-TEST-FILE 都有 |
| **測試覆蓋** | GEMS-TEST-FILE 指定的檔案都存在 |
| **規格漂移** | 程式碼與 Implementation Plan 一致 |
| **技術債** | 標記 TODO/FIXME/HACK |
| **跨模組依賴** | 檢查 GEMS-DEPS-RISK 是否正確 |

### 5.3 預期執行指令

```bash
node task-pipe/runner.cjs --phase=SCAN --target=./my-project
```

### 5.4 預期產出

```
.gems/iterations/iter-1/
└── scan_report_iter-1.json
```

---

## 6. 錯誤處理機制

### 6.1 錯誤分類

| # | 錯誤類型 | 處理策略 | 自動修復 |
|---|----------|----------|----------|
| E1 | 文案格式不符 | 模板強制重寫 | ✅ |
| E2 | Spec 文案格式錯誤 | 模板強制重寫 | ✅ |
| E3 | 模組數 vs Story 數不符 | Spec 階段設定 | ✅ |
| E4 | 迭代數/Story 數錯誤 | 強制修正 | ✅ |
| E5 | BUILD 文案格式錯誤 | Regex 格式強制 | ✅ |
| E6 | SCAN 標籤錯誤/缺失 | 強制補標籤 | ✅ |
| E7 | Gate Test 錯誤 | 報錯→回去做 | ⚠️ 需人工 |
| E8 | Spec→Story→Func 對應 | 柔性連結 | ⚠️ 需人工 |

### 6.2 三層恢復策略

```
Attempt 1: 純模板修復
    ↓ 失敗
Attempt 2: 注入相關上下文
    ↓ 失敗
Attempt 3: 完整上下文 + 人類決策準備
    ↓ 失敗
@BLOCKER → 停止，回報人類
```

### 6.3 TACTICAL_FIX 輸出格式

```
@TACTICAL_FIX
### TACTICAL_FIX-[N]: [標題]
**Attempt**: [N]/3
**Recovery Level**: [N]/3
**Error Code**: [E1-E8]

**Strategy**: [Level 1/2/3 策略說明]

**Result**: ⏳ 待驗證
**Next**: 修正後重新執行本步驟驗證
```

---

## 7. 軍規總覽

### 7.1 POC 軍規

| 軍規 | 說明 |
|------|------|
| poc-rule-0 | 禁止腦補 (Don't Guess) |
| poc-rule-0.5 | 強制視覺驗證 |
| poc-rule-1 | 契約先行 |
| poc-rule-2 | 最小產出 |
| poc-rule-3 | 行數無上限 + 工具自動壓縮 |
| poc-rule-4 | 無真實 API |
| poc-rule-5 | 獨立可測性 |

### 7.2 PLAN 軍規

| 軍規 | 說明 |
|------|------|
| rule-1 | Step 1-2-2.5-3 不跳步 |
| rule-2 | 一次只做一個模組 |
| rule-3 | POC 先行 |
| rule-4 | 明確度判定不含糊 |
| rule-5 | 需驗證就加 Phase 0 |
| rule-6 | 規格對應不憑空想像 |
| rule-7 | Iteration_Suggestions 優先 |
| rule-8 | 架構審查必做 |

### 7.3 BUILD 軍規

| 軍規 | 說明 |
|------|------|
| rule-0 | 一個 Agent 一個 Story |
| rule-1 | 開發腳本先行 |
| rule-2 | 測試依照風險規格 |
| rule-3 | TDD 測試到 100% |
| rule-4 | 標籤化驗收 |
| rule-5 | 小跑修正原則 |
| rule-6 | 修改檔案必須測試 |
| rule-7 | 完整執行 Phase 1-7 |
| rule-8 | 完成後詢問 |

---

## 8. 檔案命名與路徑約定

### 8.1 檔案命名規則

| 階段 | 檔案類型 | 命名規則 |
|------|----------|----------|
| POC | 需求草稿 | `requirement_draft_iter-X.md` |
| POC | 需求規格 | `requirement_spec_iter-X.md` |
| POC | UI 原型 | `[Module]POC.html` 或 `.tsx` |
| POC | 資料契約 | `[Module]Contract.ts` |
| PLAN | 實作計畫 | `implementation_plan_Story-X.Y.md` |
| BUILD | Fillback | `Fillback_Story-X.Y.md` |
| BUILD | Suggestions | `iteration_suggestions_Story-X.Y.json` |
| BUILD | Checkpoint | `checkpoint_Story-X.Y_phase-N.json` |
| SCAN | 掃描報告 | `scan_report_iter-X.json` |

### 8.2 目錄結構

```
.gems/iterations/iter-1/
├── poc/
│   ├── requirement_draft_iter-1.md
│   ├── requirement_spec_iter-1.md
│   ├── CalculatorContract.ts
│   └── CalculatorPOC.html
│
├── plan/
│   ├── implementation_plan_Story-1.0.md
│   └── implementation_plan_Story-1.1.md
│
├── build/
│   ├── Fillback_Story-1.0.md
│   ├── iteration_suggestions_Story-1.0.json
│   └── checkpoint_Story-1.0_phase-3.json (中間產物)
│
└── scan_report_iter-1.json
```

---

## 9. 一致性審查報告

### 9.1 文件同步狀態

| 項目 | build-flow.json | MASTER_PLAN.md | CJS 腳本 | 狀態 |
|------|-----------------|----------------|----------|------|
| Suggestions 檔名 | `iteration_suggestions_` | `iteration_suggestions_` | `iteration_suggestions_` | ✅ |
| 路徑格式 | `.gems/.../build/` | `.gems/...` | `.gems/.../build/` | ✅ |
| 覆蓋率標準 | `>= 80%` | 未定義 | `>= 80%` | ✅ |
| Schema 必填 | storyId, status | 未定義 | storyId, status | ✅ |
| Phase 6.5 | 有 | 缺 | 有 | ⚠️ |

### 9.2 BUILD Phase 一致性

| Phase | build-flow.json | CJS 實作 | 一致? |
|-------|-----------------|----------|-------|
| 1: 開發腳本 | ✅ | ✅ phase-1.cjs | ✅ |
| 2: 測試腳本 | ✅ | ✅ phase-2.cjs | ✅ |
| 3: TDD 測試 | ✅ | ✅ phase-3.cjs | ✅ |
| 4: 標籤驗收 | ✅ | ✅ phase-4.cjs | ✅ |
| 5: TDD 執行 | ✅ | ✅ phase-5.cjs | ✅ |
| 6: 修改檔案測試 | ✅ | ✅ phase-6.cjs | ✅ |
| 7: 整合檢查 | ✅ | ✅ phase-7.cjs | ✅ |
| 8: 完成規格 | ✅ | ✅ phase-8.cjs | ✅ |

### 9.3 下一步指引銜接

```
Phase 1 → 2 or 4 (依 level)  ✅
Phase 2 → 3                  ✅
Phase 3 → 4                  ✅
Phase 4 → 5                  ✅
Phase 5 → 6                  ✅
Phase 6 → 6.5                ✅
Phase 6.5 → 7                ✅
Phase 7 → 下一個 Story 或 SCAN  ✅
```

---

## 10. 快速參考

### 10.1 從零開始一個新專案

```bash
# 1. POC
node task-pipe/runner.cjs --phase=POC --step=0 --target=./new-project
node task-pipe/runner.cjs --phase=POC --step=0.5 --target=./new-project
node task-pipe/runner.cjs --phase=POC --step=1 --target=./new-project
node task-pipe/runner.cjs --phase=POC --step=2 --target=./new-project
node task-pipe/runner.cjs --phase=POC --step=3 --target=./new-project

# 2. PLAN
node task-pipe/runner.cjs --phase=PLAN --step=1 --story=Story-1.0 --target=./new-project
node task-pipe/runner.cjs --phase=PLAN --step=2 --story=Story-1.0 --target=./new-project
node task-pipe/runner.cjs --phase=PLAN --step=2.5 --story=Story-1.0 --target=./new-project
node task-pipe/runner.cjs --phase=PLAN --step=3 --story=Story-1.0 --target=./new-project

# 3. BUILD
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --target=./new-project
# ... (依序執行到 step=7)

# 4. SCAN
node task-pipe/runner.cjs --phase=SCAN --target=./new-project
```

### 10.2 繼續一個已有的專案

```bash
# 檢查當前狀態（腳本會告訴你目前在哪）
node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0 --target=./existing-project
```

### 10.3 跳過測試（Level S）

```bash
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --level=S --target=./my-project
# 完成後直接跳到 Phase 4
```

---

**文件版本**: v2.1 | **更新日期**: 2026-01-06
