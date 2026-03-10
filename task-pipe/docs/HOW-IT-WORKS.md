# SDID 運作全解 — 寫給自己看的白話版

> 版本: v2.0 | 2026-03-10
> 這份文件用最簡單的方式解釋 SDID 到底在幹嘛、怎麼運作。

---

## 一句話解釋

**SDID 是一個「讓 AI 每次進來都知道自己在哪、該做什麼」的開發框架。**

核心想法：AI 記不住東西（context window 會滿），所以把所有規格存在 JSON 字典裡。
AI 每次開新 session，讀字典就能精準施工，不靠記憶力。

---

## 你的 SDID 有哪些東西？

```
SDID/
├── sdid-tools/          ← 🔧 工具箱（Blueprint 門控、POC-FIX 等）
│   ├── blueprint/       ← Blueprint Flow 工具（gate/draft-to-plan/shrink/expand/verify）
│   ├── poc-fix/         ← POC-FIX 路線工具
│   ├── spec/            ← Spec 生成與驗收
│   └── lib/             ← 共用函式庫
├── task-pipe/           ← 🏗️ 施工管線（BUILD 八關 + 狀態追蹤）
├── .agent/skills/sdid/  ← 🧠 AI 行為規則（SKILL.md 路由 + 參考文件）
├── sdid-tools/mcp-server/ ← 🔌 MCP 伺服器（讓 Claude 直接呼叫工具）
├── sdid-monitor/        ← 📊 監控面板（看所有專案狀態的 Dashboard）
│
├── ExamForge/           ← 你的專案（裡面有 .gems/ 資料夾）
├── 訓練資源管理/         ← 你的專案
└── ...其他專案
```

---

## 全局運作流程圖

```
你有一個需求
    │
    ▼
┌─────────────────────────────────┐
│  ① AI 進入 → 讀 .state.json    │  「我在哪？該做什麼？」
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  ② 路線選擇（SKILL.md 決定）   │
│                                 │
│  模糊需求 ──→ 路線 A (Blueprint)│  「我想做一個 XXX 功能」
│  明確小修 ──→ 路線 C (MICRO-FIX)│  「幫我修這個 bug」
│  特化模組 ──→ 路線 B (POC-FIX) │  「整合第三方套件」
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  ③ 設計階段                     │
│                                 │
│  路線 A: Gem 5 輪對話收斂需求   │  產出 requirement_draft_iter-N.md
│  路線 B: 4 階段探索整合         │  產出 poc-consolidation-log.md
│  路線 C: 不需設計，直接改       │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  ④ 門控驗收（Gate）             │
│                                 │
│  路線 A: blueprint-gate.cjs     │  驗收藍圖格式 + 標籤 + 依賴
│  路線 B: micro-fix-gate.cjs     │  驗收 POC 整合結果
│  → @PASS 繼續 | @BLOCKER 修復   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  ⑤ 計畫生成                     │
│                                 │
│  路線 A: draft-to-plan.cjs      │  藍圖 → implementation_plan per Story
│  路線 B: PLAN Step 1-5          │  AI 推導 implementation_plan
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  ⑥ BUILD 八關（施工 + 驗收）    │
│                                 │
│  Phase 1: 環境 & 骨架檢查       │
│  Phase 2: GEMS 標籤驗收         │  ← 確認每個函式都有標籤
│  Phase 3: 測試模板產出           │
│  Phase 4: 測試檔存在性驗收       │
│  Phase 5: 跑測試（TDD）         │  ← npm test
│  Phase 6: 整合測試               │
│  Phase 7: 模組整合檢查           │
│  Phase 8: Fillback               │  ← 產出 iteration_suggestions
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  ⑦ SCAN / Shrink                │
│                                 │
│  路線 A: blueprint-shrink.cjs   │  收縮藍圖，進入下一 iter
│  路線 B: SCAN 階段              │  全專案掃描，更新 functions.json
│                                 │
│  ── 循環 ──                     │
└─────────────────────────────────┘
```

**關鍵：這是一個循環。** AI 施工 → 更新狀態 → 下次 AI 讀狀態 → 繼續施工。

---

## 三個層次拆解

### 🧠 決策層 — SKILL.md（告訴 AI「怎麼想」）

```
.agent/skills/sdid/
├── SKILL.md              ← 路由表：根據專案狀態決定走哪條路
└── references/
    ├── blueprint-design.md   ← Blueprint 5 輪對話的規則
    ├── taskpipe-design.md    ← Task-Pipe POC/PLAN 規則
    ├── micro-fix.md          ← 小修規則
    ├── cynefin-check.md      ← Cynefin 複雜度評估
    └── ...
```

**白話**：SKILL.md 是 AI 的「決策手冊」。
它不跑任何腳本，只告訴 AI：
- 看到 `requirement_draft_iter-N.md` → 你在 Blueprint 路線
- 看到 `poc-consolidation-log.md` → 你在 POC-FIX 路線
- 什麼都沒有 → 問用戶要走哪條

### 🔧 執行層 — sdid-tools + task-pipe（幫 AI「動手」）

```
sdid-tools/
├── blueprint/
│   ├── gate.cjs          ← 藍圖品質門控
│   ├── draft-to-plan.cjs ← 藍圖 → 執行計畫（機械轉換）
│   ├── shrink.cjs        ← 藍圖收縮（iter 完成後）
│   ├── expand.cjs        ← Stub 展開（進入下一 iter）
│   ├── verify.cjs        ← 藍圖↔源碼比對
│   └── contract-writer.cjs ← 契約生成
├── poc-fix/
│   └── micro-fix-gate.cjs ← 小修驗收
├── spec/
│   ├── gen.cjs           ← Spec 生成
│   └── gate.cjs          ← Spec 驗收
└── lib/
    ├── draft-parser-standalone.cjs ← 藍圖解析器
    └── gate-report.cjs   ← Gate 報告格式化

task-pipe/
├── runner.cjs            ← BUILD/POC/PLAN/SCAN 的統一入口
├── phases/build/
│   ├── phase-1.cjs ~ phase-8.cjs  ← BUILD 八關
│   └── ...
└── lib/shared/
    ├── state-manager-v3.cjs  ← 管理 .state.json（流程狀態）
    └── project-memory.cjs    ← 管理 project-memory.json（歷史記錄）
```

**白話**：這些是「工人」。AI 根據 SKILL.md 的指示，呼叫這些工具去做事。

### 🔌 橋接層 — MCP Server（讓 AI 不用背指令）

```
sdid-tools/mcp-server/
├── index.mjs             ← MCP 伺服器入口
└── adapters/
    ├── loop.mjs          ← sdid-loop（自動執行整個流程）
    ├── runners.mjs       ← BUILD/POC/PLAN/SCAN runner
    ├── cli-tools.mjs     ← blueprint-gate/shrink/expand 等
    └── data-tools.mjs    ← state-guide/scanner 等

暴露的主要 tools：
  sdid-loop              → 自動執行整個 SDID 流程
  sdid-build             → 呼叫 runner.cjs (BUILD/POC/PLAN)
  sdid-scan              → 呼叫 runner.cjs (SCAN)
  sdid-blueprint-gate    → 呼叫 blueprint/gate.cjs
  sdid-draft-to-plan     → 呼叫 blueprint/draft-to-plan.cjs
  sdid-shrink            → 呼叫 blueprint/shrink.cjs
  sdid-expand            → 呼叫 blueprint/expand.cjs
  sdid-verify            → 呼叫 blueprint/verify.cjs
  sdid-micro-fix-gate    → 呼叫 poc-fix/micro-fix-gate.cjs
```

**白話**：沒有 MCP 的時候，AI 要自己打 `node sdid-tools/blueprint/gate.cjs --draft=...`。
有了 MCP，AI 直接說「我要呼叫 sdid-blueprint-gate」就好，不用背路徑和參數。

---

## 資料在哪？— .gems/ 目錄

每個專案裡都有一個 `.gems/` 資料夾，是 SDID 的「記憶體」。

```
ExamForge/.gems/
│
├── docs/                         ← 📕 掃描產出（SCAN 後更新）
│   ├── functions.json            ← 所有函式規格（含 GEMS 標籤）
│   ├── function-index.json       ← 函式地圖（哪個函式在哪個檔案）
│   ├── CONTRACT.md               ← 契約文件
│   └── TECH_STACK.md             ← 技術棧說明
│
├── project-memory.json           ← 🧠 歷史記憶（踩過的坑）
│
└── iterations/iter-N/            ← 📁 第 N 輪迭代
    ├── .state.json               ← 流程走到哪了
    ├── logs/                     ← 所有 phase 的 log
    ├── poc/                      ← POC/Blueprint 設計產出
    │   ├── requirement_draft_iter-N.md  ← 活藍圖（路線 A）
    │   ├── requirement_spec_iter-N.md   ← 需求規格（路線 B）
    │   ├── xxxContract.ts               ← 資料契約
    │   └── xxxPOC.html                  ← UI 原型（路線 B）
    ├── plan/                     ← 施工計畫
    │   └── implementation_plan_Story-X.Y.md
    └── build/                    ← BUILD 的中間產物
        ├── Fillback_Story-X.Y.md
        └── iteration_suggestions_Story-X.Y.json
```

---

## 兩條路線詳解

### 路線 A：Blueprint Flow（模糊需求 → 完整功能）

```
你說：「我想做一個 PDF 解析功能」
  │
  ▼
Gemini Gem 5 輪對話（收斂需求）
  │  Round 1: 目標釐清
  │  Round 1.5: 變異點分析（條件觸發）
  │  Round 2: 實體識別
  │  Round 3: 模組拆分
  │  Round 4: 迭代規劃
  │  Round 5: 動作細化
  │
  ▼
產出 requirement_draft_iter-1.md（活藍圖）
  │
  ▼
blueprint-gate.cjs 驗收 → @PASS
  │
  ▼
draft-to-plan.cjs 機械轉換 → implementation_plan_Story-X.Y.md
  │
  ▼
BUILD Phase 1-8（AI 按計畫施工）
  │
  ▼
blueprint-shrink.cjs 收縮藍圖
  │
  ▼
（可選）blueprint-expand.cjs → 進入 iter-2
  │
  ▼
完成 ✓
```

### 路線 B：Task-Pipe Flow（傳統 POC → PLAN → BUILD）

```
你說：「幫我整合 pdfjs-dist 套件」
  │
  ▼
POC Step 0-3（模糊消除 + 契約設計 + UI 原型 + 需求規格）
  │
  ▼
PLAN Step 1-5（需求確認 + 規格注入 + 架構審查 + 實作計畫）
  │
  ▼
BUILD Phase 1-8（與路線 A 共用）
  │
  ▼
SCAN（全專案掃描，更新 functions.json）
  │
  ▼
完成 ✓
```

---

## 三條路線對照

| 情境 | 推薦路線 | 原因 |
|------|---------|------|
| 全新專案，需求模糊 | A (Blueprint) | Gem 對話更自然，分層拆解更直覺 |
| 既有專案，加新功能 | B (Task-Pipe) | POC 可以掃描現有結構 |
| 需求含「彈性」「客製化」 | A (Blueprint) | Round 1.5 變異點分析專門處理 |
| 小 bug 修復 | C (MICRO-FIX) | 不需要完整流程 |

---

## 監控面板

```bash
node sdid-monitor/server.cjs
# 開瀏覽器 → http://localhost:3737
```

看到所有專案的即時狀態：
- 訓練資源管理: BUILD Phase 8 / Story-4.0 / @BLOCK
- ExamForge: iter-11 / DONE / @PASS

---

## FAQ

**Q: SKILL.md 跟 MCP 有什麼差別？**
A: SKILL.md 是「AI 的行為手冊」（決策層），MCP 是「工具的 API」（執行層）。
   SKILL.md 告訴 AI「你現在該跑 blueprint-gate」，MCP 讓 AI 能直接呼叫它。

**Q: 沒有 MCP 可以用嗎？**
A: 可以。AI 自己手動跑 `node sdid-tools/blueprint/gate.cjs --draft=...`。
   MCP 只是讓這件事更方便（不用背路徑和參數）。

**Q: 路線 A 和路線 B 的 BUILD 有什麼不同？**
A: 完全相同，共用 `task-pipe/runner.cjs`。差別只在 BUILD 之前的設計階段。

**Q: .gems/ 要加到 .gitignore 嗎？**
A: 目前是加的。字典是框架產物，不進版控。

**Q: BUILD 八關每一關在幹嘛？**
A:
   1. 環境檢查（node/npm 可用嗎？src 目錄在嗎？）
   2. 標籤驗收（每個函式都有 GEMS 標籤嗎？有空殼函式嗎？）
   3. 測試模板（根據計畫產出測試骨架）
   4. 測試檔檢查（測試檔存在嗎？import 正確嗎？）
   5. 跑測試（npm test，失敗就停）
   6. 整合測試（跨模組測試）
   7. 整合檢查（循環依賴？匯出正確？）
   8. Fillback（產出 Fillback + iteration_suggestions）

**Q: functions.json 是什麼？**
A: SCAN 階段掃描 src/ 產出的函式索引，記錄每個函式的 GEMS 標籤、位置、依賴。
   blueprint-verify.cjs 用它來比對藍圖↔源碼一致性。

---

**文件版本**: v2.0 | **方法論**: SDID v2.1 | **日期**: 2026-03-10
