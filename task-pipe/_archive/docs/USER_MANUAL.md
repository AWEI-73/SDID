# 📖 Task-Pipe 使用說明書 (User Manual)

**版本**: v3.5 | **日期**: 2026-02-08 | **方法論**: SDID (語意驅動迭代開發)

---

## 這是什麼？

Task-Pipe 是一套讓 AI 幫你寫程式的硬流程框架。

核心循環很簡單：**腳本 print → AI 讀取 → AI 執行 → 重複直到通過**

你不需要懂它的內部實作。你只需要知道：
1. 怎麼啟動
2. 什麼時候要介入
3. 出問題怎麼辦

---

## 兩種使用模式

### 模式 A：Ralph Loop (全自動)

適合：確定性高的功能 — CRUD、計算邏輯、UI、Mock 資料

```bash
# 新專案 (一鍵啟動)
node task-pipe/skills/ralph-loop/scripts/loop.cjs --new --project=my-app --type=todo

# 繼續現有專案 (自動偵測進度)
node task-pipe/skills/ralph-loop/scripts/loop.cjs --project=./my-app
```

AI 會自動跑完 POC → PLAN → BUILD → SCAN，你只需要：
- 開始前：準備好 requirement_draft (或讓它自動生成)
- 過程中：看它跑，偶爾看一下 log
- 卡住時：讀 error log，修一下，再跑

Ralph Loop 能跑多遠取決於 Draft 的品質。Draft 越精確，自動化程度越高。

### 模式 B：手動驅動 (半自動)

適合：第三方 API 串接、edge case 多的功能、需要人工判斷的 Story

```bash
# 你在 chat 裡跟 AI 說：
"跑 POC Step 1 for my-app"
# AI 執行：
node task-pipe/runner.cjs --phase=POC --step=1 --target=./my-app

# 你看結果，覺得 OK：
"下一步"
# AI 執行 Step 2...

# 測試失敗，你看 log 說要改：
"webhook 那邊改成 async，然後重跑 Phase 5"
# AI 改完重跑
```

跑的是同一套 runner、同一套門控、同一套驗證。差別只是誰在按「下一步」。

---

## 快速開始：5 分鐘建立第一個專案

### Step 1：建立專案目錄

```bash
mkdir my-app
```

### Step 2：建立 Draft

在 `my-app/.gems/iterations/iter-1/poc/` 建立 `requirement_draft_iter-1.md`：

```markdown
# 📋 My App - 需求草稿

**迭代**: iter-1
**日期**: 2026-02-08
**狀態**: ✅ PASS

---

## 一句話目標
建立一個簡潔的待辦事項管理應用，支援新增、完成、刪除任務

## 用戶原始需求

> 使用者希望有一個 Todo 應用來管理日常任務，
> 支援新增任務、標記完成、刪除任務，資料存在 LocalStorage。

---

## 🏗️ 模組化設計藍圖

### 1. 族群識別
| 族群名稱 | 描述 | 特殊需求 |
|---------|------|---------|
| 一般使用者 | 管理日常任務 | 無 |

### 2. 共用模組 (Shared)
- [x] 基礎建設 (types, config)
- [x] 儲存層 (LocalStorage CRUD)

### 3. 獨立模組 (Modules)

#### 模組：tasks
- 依賴: [shared/types, shared/storage]
- 獨立功能:
  - [x] 新增任務
  - [x] 標記完成
  - [x] 刪除任務

### 4. 路由結構
```
main.ts
└── tasks/* → 任務管理
```

---

## 功能模組清單
- [x] 基礎建設 (types, config)
- [x] 任務管理模組 (Task CRUD)

### 不做什麼
- 不做使用者登入
- 不做雲端同步

---

## 釐清項目

### 使用者角色
- [x] 主要使用者：一般使用者

### 核心目標
- [x] 解決問題：管理日常任務
- [x] 預期效益：快速新增和追蹤待辦事項

### 資料結構
- [x] 核心實體：Task (id, title, completed, createdAt)

### 邊界條件
- [x] 資料量限制：LocalStorage 5MB

---

**草稿狀態**: [OK] PASS
**POC Level**: M
```

### Step 3：開跑

```bash
# 方法 A：Ralph Loop 全自動
node task-pipe/skills/ralph-loop/scripts/loop.cjs --project=./my-app

# 方法 B：手動一步一步
node task-pipe/runner.cjs --phase=POC --step=1 --target=./my-app
```

---

## 四階段流程

```
POC (概念驗證)  →  PLAN (規格設計)  →  BUILD (實作測試)  →  SCAN (品質掃描)
 Step 1-5           Step 1-5           Phase 1-8           全專案
 人腦密集            半自動              全自動               一鍵
```

### POC 階段 (Step 1-5) — 最花時間，最重要

| Step | 做什麼 | 產出 |
|------|--------|------|
| 1 | 模糊消除 — 確認需求沒有模糊地帶 | 驗證過的 draft |
| 2 | 規模評估 — 判斷 S/M/L | 更新 draft |
| 3 | 契約設計 — 定義資料結構 | `xxxContract.ts` |
| 4 | UI 原型 — 做出可運行的 HTML | `xxxPOC.html` |
| 5 | 需求規格 — 拆 Story + 驗收標準 | `requirement_spec_iter-X.md` |

```bash
node task-pipe/runner.cjs --phase=POC --step=1 --target=./my-app
node task-pipe/runner.cjs --phase=POC --step=2 --target=./my-app
node task-pipe/runner.cjs --phase=POC --step=3 --target=./my-app
node task-pipe/runner.cjs --phase=POC --step=4 --target=./my-app
node task-pipe/runner.cjs --phase=POC --step=5 --target=./my-app
```

### PLAN 階段 (Step 1-5) — 從 Spec 拆出可執行的計畫

| Step | 做什麼 | 產出 |
|------|--------|------|
| 1 | 需求確認 | Story 選擇 |
| 2 | 規格注入 | Plan 草稿 |
| 3 | 架構審查 | 審查報告 |
| 4 | 標籤規格 | GEMS 標籤模板 |
| 5 | 需求規格說明 | `implementation_plan_Story-X.Y.md` |

```bash
node task-pipe/runner.cjs --phase=PLAN --step=1 --target=./my-app
# ... Step 2-5
```

### BUILD 階段 (Phase 1-8) — AI 全自動寫 code + 測試

| Phase | 做什麼 | 驗證條件 |
|-------|--------|----------|
| 1 | 寫功能程式碼 + GEMS 標籤 | 型別檢查 0 errors |
| 2 | 寫測試 | 測試檔案存在 + 編碼正確 |
| 3 | 跑測試 (TDD) | 100% pass |
| 4 | 標籤驗收 | 覆蓋率 ≥ 80% |
| 5 | Test Gate | P0/P1 測試 100% |
| 6 | 修改檔案測試 | 不破壞現有功能 |
| 7 | 整合檢查 | routes/exports/UI Bind |
| 8 | 完成規格 | Fillback + Suggestions |

```bash
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.1 --target=./my-app
# ... Phase 2-8
```

### SCAN 階段 — 全專案掃描

```bash
node task-pipe/runner.cjs --phase=SCAN --target=./my-app
```

產出：`functions.json`、`function-index.json`、`system-blueprint.json`、`CONTRACT.md`

---

## 常用指令速查

```bash
# === 狀態查詢 ===
node task-pipe/tools/story-status.cjs --target=./my-app

# === Ralph Loop ===
node task-pipe/skills/ralph-loop/scripts/loop.cjs --project=./my-app              # 繼續
node task-pipe/skills/ralph-loop/scripts/loop.cjs --new --project=my-app --type=todo  # 新專案
node task-pipe/skills/ralph-loop/scripts/loop.cjs --project=./my-app --force-start=POC-1  # 強制重頭

# === 手動執行 ===
node task-pipe/runner.cjs --phase=POC --step=1 --target=./my-app
node task-pipe/runner.cjs --phase=PLAN --step=1 --target=./my-app --story=Story-1.0
node task-pipe/runner.cjs --phase=BUILD --step=1 --target=./my-app --story=Story-1.1
node task-pipe/runner.cjs --phase=SCAN --target=./my-app

# === 常用選項 ===
--level=S          # 快速原型 (跳過部分測試)
--level=M          # 標準模式 (預設)
--level=L          # 嚴格模式
--iteration=iter-2 # 指定迭代
--dry-run          # 預覽不執行
```

---

## 專案規模選擇

| Level | 名稱 | 最大 Stories | BUILD Phases | 適合 |
|-------|------|-------------|--------------|------|
| S | Prototype | 3 | 1, 2, 4, 8 | 快速原型、概念驗證 |
| M | Standard | 6 | 1-5, 7, 8 | 標準開發 (預設) |
| L | Strict | 10 | 全部 | 企業級、高風險 |

---

## 產出目錄結構

```
my-app/
├── .gems/
│   └── iterations/
│       └── iter-1/
│           ├── poc/                              # POC 產出
│           │   ├── requirement_draft_iter-1.md    # 你寫的需求
│           │   ├── requirement_spec_iter-1.md     # AI 產出的規格
│           │   ├── xxxContract.ts                 # 資料契約
│           │   └── xxxPOC.html                    # UI 原型
│           ├── plan/                              # PLAN 產出
│           │   └── implementation_plan_Story-X.Y.md
│           ├── build/                             # BUILD 產出
│           │   ├── Fillback_Story-X.Y.md
│           │   └── iteration_suggestions_Story-X.Y.json
│           └── logs/                              # 執行紀錄
├── .task-pipe/
│   └── state.json                                 # 進度追蹤
└── src/                                           # 實際程式碼
```

---

## 出問題怎麼辦

### 情況 1：腳本輸出 BLOCKER

表示門控沒過，需要修正。看 `@TASK` 區塊的指示，照做就好。

### 情況 2：TACTICAL_FIX (重試中)

系統會自動重試最多 3 次。如果 3 次都失敗，會升級為 BLOCKER。

### 情況 3：測試一直失敗

```bash
# 看最新的 error log
# 位置：.gems/iterations/iter-X/logs/
# 找 @TACTICAL_FIX 區塊，裡面有修復建議
```

### 情況 4：想從頭來過

```bash
# Ralph Loop 強制重頭
node task-pipe/skills/ralph-loop/scripts/loop.cjs --project=./my-app --force-start=POC-1

# 或手動指定
node task-pipe/runner.cjs --phase=POC --step=1 --target=./my-app
```

### 情況 5：想跳到特定步驟

```bash
# 直接指定 phase + step
node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.1 --target=./my-app
```

---

## 實戰場景

### 場景 1：全新 CRUD 應用 (全自動)

```
1. 寫好 Draft (或用 Ralph Loop --new 自動生成)
2. Ralph Loop 放著跑
3. 等它跑完，你有一個完整的應用 + 測試 + 文件
```

預期時間：S 級 ~10 分鐘，M 級 ~30 分鐘

### 場景 2：既有專案加新功能

```
1. 先跑 SCAN 掃描現有結構
   node task-pipe/runner.cjs --phase=SCAN --target=./my-app

2. 建立新迭代的 Draft
   .gems/iterations/iter-2/poc/requirement_draft_iter-2.md

3. 跑 POC → PLAN → BUILD → SCAN
   (前一迭代的 iteration_suggestions 會自動注入)
```

### 場景 3：串接第三方 API (半自動)

```
1. Iter 1-2：用 Ralph Loop 跑完基礎功能 (Mock 資料)
2. Iter 3+：手動驅動，一個 API 一個 Story
   - 你：「跑 BUILD Phase 1 for Story-3.1 (Stripe 串接)」
   - AI 寫 code
   - 你：「Phase 3 跑測試」
   - 測試失敗 → 你看 log → 告訴 AI 怎麼改
   - 重跑直到通過
```

### 場景 4：大型專案 (SDID 藍圖模式)

```
1. 用 Chatbot 藍圖架構師產出 Enhanced Draft
   (5 輪對話：目標 → 實體 → 模組 → 迭代規劃 → 動作清單)

2. Enhanced Draft 放入 .gems/iterations/iter-1/poc/

3. 按迭代規劃表逐 iter 執行
   - deps=[] 的模組可並行 (不同 Agent 同時跑)
   - 有依賴的模組等前置完成再跑

4. 每個 iter 完成後，iteration_suggestions 自動傳承到下一個
```

---

## 錯誤恢復系統 v2.0

系統有三層策略漂移，重試不是單純重複：

| Level | 重試次數 | 策略 | 行動 |
|-------|---------|------|------|
| 🔧 1 | 1-3 次 | TACTICAL_FIX | 局部修補 |
| 🔄 2 | 4-6 次 | STRATEGY_SHIFT | 換方式實作 |
| ⚠️ 3 | 7+ 次 | PLAN_ROLLBACK | 回退到 PLAN 重新設計 |

你通常不需要管這些 — 系統會自動處理。只有到 BLOCKER 時才需要你介入。

---

## 關於 Ralph Loop 能跑多遠

老實說，取決於三件事：

1. **Draft 品質** — Draft 越精確 (實體表格、模組動作清單都有)，AI 推導越準，卡住的機率越低
2. **專案複雜度** — 純 CRUD + Mock 資料 = 幾乎 100% 自動。有第三方 API = 需要人工介入
3. **AI 的 context window** — 太大的 Story 會讓 AI 迷路。保持每個 Story 小而精確

一般來說：
- S 級專案：Ralph Loop 能跑完整個 iter
- M 級專案：POC 可能需要 1-2 次人工修正 Draft，之後 PLAN → BUILD 自動
- L 級專案：POC 一定需要人工，PLAN 半自動，BUILD 大部分自動

**POC 是瓶頸，POC 做好了後面就是自動化。**

---

## 相關文件

| 文件 | 用途 |
|------|------|
| `MASTER_PLAN.md` | 系統架構總覽 (開發者看) |
| `docs/BLUEPRINT_FORMAT_SPEC.md` | SDID 藍圖格式規格 |
| `docs/guides/GEMS_TAG_SYSTEM_v2.md` | GEMS 標籤完整說明 |
| `skills/ralph-loop/SKILL.md` | Ralph Loop 技能說明 |
| `docs/BLUEMOUSE_GUIDE.md` | BlueMouse 整合 |

---

*Task-Pipe v3.5 | SDID v1.0 | 2026-02-08*
