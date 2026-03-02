# SDID 運作全解 — 寫給自己看的白話版

> 版本: v1.0 | 2026-03-02
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
├── sdid-tools/          ← 🔧 工具箱（獨立腳本，不綁專案）
├── task-pipe/           ← 🏗️ 施工管線（BUILD 八關 + 狀態追蹤）
├── .agent/skills/sdid/  ← 🧠 AI 行為規則（SKILL.md 路由 + 參考文件）
├── sdid-tools/mcp-server/ ← 🔌 MCP 伺服器（讓 Claude Code 直接呼叫工具）
├── sdid-monitor/        ← 📊 監控面板（看所有專案狀態的 Dashboard）
│
├── ExamForge/           ← 你的專案（裡面有 .gems/ 資料夾）
├── Task-Priority-AI/    ← 你的專案
└── ...其他專案
```

---

## 全局運作流程圖

```
你有一個需求
    │
    ▼
┌─────────────────────────────────┐
│  ① AI 進入 → 呼叫 state-guide  │  「我在哪？該做什麼？」
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  ② 路線選擇（SKILL.md 決定）   │
│                                 │
│  模糊需求 ──→ BLUEPRINT 路線   │  「我想做一個 XXX 功能」
│  明確小修 ──→ MICRO-FIX 路線   │  「幫我修這個 bug」
│  特化模組 ──→ POC-FIX 路線     │  「整合第三方 PDF 套件」
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  ③ 設計階段                     │
│                                 │
│  BLUEPRINT: 5 輪對話收斂需求    │  產出 requirement-draft.md
│  POC-FIX:   4 階段探索整合      │  產出 poc-consolidation-log.md
│  MICRO-FIX: 不需設計，直接改    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  ④ 字典生成（spec-gen）         │  把設計文件轉成 JSON 字典
│                                 │  .gems/specs/*.json
│     requirement-draft.md        │
│          ↓ spec-gen             │
│     specs/pdf-text-extractor.json │
│     specs/_index.json           │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  ⑤ BUILD 八關（施工 + 驗收）    │
│                                 │
│  Phase 1: 環境 & 骨架檢查       │
│  Phase 2: GEMS 標籤驗收         │  ← 確認每個函式都有標籤
│  Phase 3: 測試模板產出           │
│  Phase 4: 測試檔存在性驗收       │
│  Phase 5: 跑測試（TDD）         │  ← npm test
│  Phase 6: 整合測試               │
│  Phase 7: 模組整合檢查           │
│  Phase 8: 字典回寫（Fillback）   │  ← 把行號同步回字典
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  ⑥ 字典更新完成                 │
│                                 │
│  AI 下次進來 → state-guide      │
│  讀到最新字典 → 知道下一步      │
│                                 │
│  ── 循環 ──                     │
└─────────────────────────────────┘
```

**關鍵：這是一個循環。** AI 施工 → 更新字典 → 下次 AI 讀字典 → 繼續施工。

---

## 三個層次拆解

### 🧠 決策層 — SKILL.md（告訴 AI「怎麼想」）

```
.agent/skills/sdid/
├── SKILL.md              ← 路由表：根據專案狀態決定走哪條路
└── references/
    ├── blueprint-design.md   ← Blueprint 5 輪對話的規則
    ├── build-execution.md    ← BUILD 八關的施工規則
    ├── poc-fix.md            ← POC-FIX 四階段規則
    ├── micro-fix.md          ← 小修規則
    └── ...
```

**白話**：SKILL.md 是 AI 的「決策手冊」。
它不跑任何腳本，只告訴 AI：
- 看到 `requirement-draft.md` → 你在 Blueprint 路線
- 看到 `poc-consolidation-log.md` → 你在 POC-FIX 路線
- 什麼都沒有 → 問用戶要走哪條

### 🔧 執行層 — sdid-tools + task-pipe（幫 AI「動手」）

```
sdid-tools/
├── state-guide.cjs       ← AI 進入時呼叫（你在哪？做什麼？）
├── spec-gen.cjs          ← 設計文件 → JSON 字典
├── spec-gate.cjs         ← 字典品質驗收（5 項檢查）
├── gems-scanner-v2.cjs   ← 掃描程式碼裡的 @GEMS 標籤
├── dict-sync.cjs         ← 程式碼行號 → 回寫字典
├── blueprint-gate.cjs    ← 設計文件品質驗收
├── micro-fix-gate.cjs    ← 小修驗收
└── tag-shrink.cjs        ← 壓縮 GEMS 標籤（完整→精簡）

task-pipe/
├── runner.cjs            ← BUILD 的統一入口（跑哪個 phase/step）
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
└── package.json

暴露 9 個 tools：
  sdid-state-guide       → 呼叫 state-guide.cjs
  sdid-build             → 呼叫 runner.cjs (BUILD/POC/PLAN)
  sdid-scan              → 呼叫 runner.cjs (SCAN)
  sdid-spec-gen          → 呼叫 spec-gen.cjs
  sdid-spec-gate         → 呼叫 spec-gate.cjs
  sdid-dict-sync         → 呼叫 dict-sync.cjs
  sdid-scanner           → 呼叫 gems-scanner-v2.cjs
  sdid-blueprint-gate    → 呼叫 blueprint-gate.cjs
  sdid-micro-fix-gate    → 呼叫 micro-fix-gate.cjs
```

**白話**：沒有 MCP 的時候，AI 要自己打 `node sdid-tools/spec-gate.cjs --project=ExamForge`。
有了 MCP，AI 直接說「我要呼叫 sdid-spec-gate」就好，不用背路徑和參數。

**SKILL.md 跟 MCP 的關係：**
```
SKILL.md = 大腦（決定做什麼）
MCP      = 雙手（執行具體動作）

SKILL.md 說：「現在要驗字典」
MCP 就提供：sdid-spec-gate 這個 tool 讓 AI 呼叫
```

---

## 資料在哪？— .gems/ 目錄

每個專案裡都有一個 `.gems/` 資料夾，是 SDID 的「記憶體」。

```
ExamForge/.gems/
│
├── specs/                        ← 📕 字典（最重要）
│   ├── _index.json               ← 總目錄：哪個函式在哪個字典檔
│   ├── pdf-text-extractor.json   ← 某模組的所有函式規格
│   └── question_bank.json        ← 另一個模組的函式規格
│
├── function-index-v2.json        ← 📍 函式地圖（掃描程式碼產出）
├── functions-v2.json             ← 📋 所有函式列表（含未標籤的）
├── project-memory.json           ← 🧠 歷史記憶（踩過的坑）
├── last_step_result.json         ← ⏱️ 上次執行結果
│
└── iterations/iter-1/            ← 📁 第一輪迭代
    ├── .state.json               ← 流程走到哪了
    ├── logs/                     ← 所有 phase 的 log
    ├── poc/                      ← POC 階段的產出
    ├── plan/                     ← 施工計畫
    └── build/                    ← BUILD 的中間產物
```

### 字典長什麼樣？

```json
{
  "PDF.ParseBufferWithImages": {
    "priority": "P0",
    "status": "✓✓",
    "signature": "(buf: Buffer) → ParseResult",
    "targetFile": "src/pdf/parser.ts",
    "lineRange": "L589-653",
    "flow": ["ValidateInput", "ParsePages", "ExtractImages", "Return"],
    "deps": ["pdfjs-dist"],
    "allowedImports": ["pdfjs-dist", "@internal/util"],
    "ac": ["Given a valid PDF, When parsed, Then returns text + images"],
    "storyRef": "Story-11.1"
  }
}
```

**每個函式的規格都在這裡。** AI 進來讀字典，就知道：
- 這個函式在 `src/pdf/parser.ts` 的第 589-653 行
- 執行流程是 ValidateInput → ParsePages → ExtractImages → Return
- 只允許 import `pdfjs-dist` 和 `@internal/util`
- 驗收條件是「Given a valid PDF, When parsed, Then returns text + images」

---

## 三條路線詳解

### 路線 A：BLUEPRINT（模糊需求 → 完整功能）

```
你說：「我想加一個 PDF 解析功能」
  │
  ▼
Round 1-5（AI 跟你對話收斂需求）
  │  Round 1: 模組動作清單
  │  Round 2: 簽名＋流程
  │  Round 3: 依賴＋風險
  │  Round 4: 驗收條件
  │  Round 5: 總覽確認
  │
  ▼
產出 requirement-draft.md（設計文件）
  │
  ▼
blueprint-gate 驗收 → PASS
  │
  ▼
spec-gen 生成字典 → .gems/specs/*.json
  │
  ▼
spec-gate 驗收字典 → PASS
  │
  ▼
BUILD Phase 1-8（AI 按字典施工）
  │
  ▼
dict-sync 回寫行號 → 字典更新
  │
  ▼
完成 ✓
```

### 路線 B：POC-FIX（特化/第三方模組探索）

```
你說：「幫我整合 pdfjs-dist 套件」
  │
  ▼
SETUP（確認環境 + 安裝套件）
  │
  ▼
VERIFY（寫 POC 驗證套件能用）← 可能迭代多次
  │
  ▼
CONSOLIDATE（整理 POC 結果 → poc-consolidation-log.md）
  │
  ▼
BUILD + TEST（正式實作 + 測試）
  │
  ▼
完成 ✓
```

### 路線 C：MICRO-FIX（小修）

```
你說：「幫我修 parser.ts 的 bug」
  │
  ▼
AI 直接改程式碼
  │
  ▼
micro-fix-gate 驗收（標籤完整性 + 測試存在）
  │
  ▼
完成 ✓
```

---

## 部署給別人用

要給別人用 SDID，需要給兩個東西：

```
給專案的東西：
├── .agent/skills/sdid/      ← SKILL.md + 參考文件（放進專案）
│   AI 讀這些來決定路線
│
└── .claude/settings.json    ← MCP 配置（指向 MCP Server）
    {
      "mcpServers": {
        "sdid": {
          "command": "node",
          "args": ["/path/to/sdid-tools/mcp-server/index.mjs"]
        }
      }
    }

框架本體（獨立部署）：
├── sdid-tools/              ← 所有工具腳本
├── sdid-tools/mcp-server/   ← MCP 伺服器
└── task-pipe/               ← BUILD 管線
```

```
SKILL.md = 裝在 AI 腦裡的行為規則（隨專案走）
MCP      = 裝在電腦上的工具服務（獨立部署，多專案共用）
```

---

## 監控面板

```bash
node sdid-monitor/server.cjs
# 開瀏覽器 → http://localhost:3737
```

看到所有專案的即時狀態：
- ExamForge: BUILD Phase 3 / Story-11.1 / 覆蓋率 72%
- Task-Priority-AI: COMPLETE / iter-1

---

## 一張圖看完所有關係

```
┌──────────────────────────────────────────────────────────────┐
│                        你（用戶）                             │
│                    「我想做 XXX」                             │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│                      Claude Code（AI）                        │
│                                                              │
│  ┌────────────────┐     ┌─────────────────────────────────┐ │
│  │   SKILL.md     │     │         MCP Server              │ │
│  │  （大腦）      │────▶│        （雙手）                 │ │
│  │                │     │                                 │ │
│  │ 決定走哪條路   │     │  sdid-state-guide   呼叫→ state-guide.cjs  │
│  │ 決定下一步     │     │  sdid-build         呼叫→ runner.cjs      │
│  │ 提供施工規則   │     │  sdid-spec-gen      呼叫→ spec-gen.cjs    │
│  │                │     │  sdid-spec-gate     呼叫→ spec-gate.cjs   │
│  └────────────────┘     │  sdid-scanner       呼叫→ scanner-v2.cjs  │
│                         │  sdid-dict-sync     呼叫→ dict-sync.cjs   │
│                         │  ...                                      │
│                         └─────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│                      你的專案                                 │
│                                                              │
│  src/                    .gems/                              │
│  ├── pdf/                ├── specs/*.json    ← 字典          │
│  │   └── parser.ts       ├── function-index  ← 函式地圖     │
│  └── ...                 ├── project-memory  ← 歷史記憶     │
│                          └── iterations/     ← 流程狀態     │
│                                                              │
│  程式碼 ←──dict-sync──→ 字典（雙向同步）                     │
└──────────────────────────────────────────────────────────────┘
```

---

## FAQ

**Q: SKILL.md 跟 MCP 有什麼差別？**
A: SKILL.md 是「AI 的行為手冊」（決策層），MCP 是「工具的 API」（執行層）。
   SKILL.md 告訴 AI「你現在該跑 spec-gate」，MCP 讓 AI 能直接呼叫它。

**Q: 沒有 MCP 可以用嗎？**
A: 可以。AI 自己手動跑 `node sdid-tools/spec-gate.cjs --project=ExamForge`。
   MCP 只是讓這件事更方便（不用背指令）。

**Q: 沒有 SKILL.md 可以用嗎？**
A: 可以，但 AI 不知道該走哪條路線，你得自己告訴它。
   SKILL.md 讓 AI 自動判斷路線，省去你每次解釋的時間。

**Q: .gems/ 要加到 .gitignore 嗎？**
A: 目前是加的。字典是框架產物，不進版控。
   但 specs/ 裡的字典其實很有價值，未來可能考慮納入版控。

**Q: state-guide 讀了什麼？**
A: 它讀 4 種資料：
   1. `.state.json` → 流程走到哪了
   2. `specs/*.json` → 字典規格
   3. `function-index-v2.json` → 函式位置
   4. `project-memory.json` → 歷史教訓
   然後組成 5 個區塊的「指令包」給 AI。

**Q: BUILD 八關每一關在幹嘛？**
A:
   1. 環境檢查（node/npm 可用嗎？src 目錄在嗎？）
   2. 標籤驗收（每個函式都有 @GEMS 標籤嗎？有空殼函式嗎？）
   3. 測試模板（根據字典的 AC 產出測試骨架）
   4. 測試檔檢查（測試檔存在嗎？import 正確嗎？）
   5. 跑測試（npm test，失敗就停）
   6. 整合測試（跨模組測試）
   7. 整合檢查（循環依賴？匯出正確？）
   8. 字典回寫（行號同步回字典，status 更新）
