# SDID 2026 開發流程總覽

> 版本: v1.0 | 日期: 2026-02-27
> 定位: 使用 SDID 開發專案時的實際操作手冊

---

## 核心路由

| 場景 | 路線 |
|------|------|
| 大型功能規劃 | Blueprint → Enhanced Draft → 拆任務 |
| 複雜/特化模組（第三方串接、演算法、資料處理） | POC-FIX |
| 單一函式微調、補標籤 | MICRO-FIX |
| Task-Pipe | 保留，式微中 |

---

## 主流程

```
Blueprint 對話 → Enhanced Draft → 拆任務（錨點 + 任務配給）
    │
    ├── 複雜模組 ──→ POC-FIX
    │                 Phase 1: SETUP       → poc-setup-{ts}.log
    │                 Phase 2: VERIFY      → poc-verify-round{N}-{pass|fail}-{ts}.log
    │                 Phase 3: CONSOLIDATE → poc-consolidation-log.md
    │                 Phase 4: BUILD       → 見下方 BUILD 章節
    │
    └── 微調 ──────→ MICRO-FIX → micro-fix-gate
    │
    ↓
SCAN → 字典 JSON（.gems/specs/*.json，含 lastModified）
```

---

## BUILD 八道關卡

BUILD 是共用的，不管從哪條路進來（Blueprint / POC-FIX）都走同一套。
差別只在**輸入來源**，關卡本身不變。

| 路線 | BUILD 的輸入來源 |
|------|----------------|
| Blueprint | Enhanced Draft 拆出的錨點 |
| POC-FIX | poc-consolidation-log.md + poc/ 檔案 |
| MICRO-FIX | 直接指定函式，不走完整 BUILD |

### 八道關卡

```
Phase 1: 骨架檢查      — 確認環境、檔案結構、plan 格式合法
Phase 2: 標籤驗收      — 掃 src 確保每個函式有 @GEMS 錨點（The Enforcer）
Phase 3: 測試腳本      — 寫測試檔案
Phase 4: Test Gate     — 驗證測試檔案存在且 import 被測函式
Phase 5: TDD 執行      — 跑 Unit / Integration 測試
Phase 6: 整合測試      — 跨模組整合測試
Phase 7: 整合檢查      — 路由、模組匯出、依賴關係
Phase 8: Fillback      — 產出 iteration_suggestions + 同步更新字典 JSON
```

### 依需求可跳過的關卡

| 場景 | 可跳過 | 不可跳過 |
|------|--------|---------|
| POC-FIX 落地 | Phase 1（骨架已存在）、Phase 6 | Phase 2、3、4、5、7、8 |
| 簡單模組 | Phase 6 | 其餘 |
| 完整功能 | 無 | 全部 |

> 跳過的判斷由 AI 根據 consolidation-log 的 changed 範圍決定，不是預設跳。

---

## 監控層

觸發來源 → 執行 `update-hub.cjs` → 同時寫 `hub.json` + `workspace-hub.md`

| 觸發 | 時機 |
|------|------|
| fs.watch（server.cjs） | .gems/ 或框架目錄有變動，debounce 1.2s 後觸發 |
| git post-commit hook | 每次 commit |
| POST /api/hub/rebuild | 手動 |

### workspace-hub.md 內容（認知快照）

```
# SDID Workspace 認知快照

## ROADMAP 進度
P0 ✅ P0.5 ✅ P0.8 ✅ P1 ✅ P1.5 ✅ P2 ✅ P3 ✅ P4 ✅
P5 ✅ P6 🔒 P7 ✅ P8 ✅ P9 🔒 P10 ✅

## 專案即時狀態
ExamForge    → iter-11 / POC-FIX Phase 2 / VERIFY Round 3
time-echo    → iter-1  / BUILD Phase 5 / @PASS
control-tower→ iter-6  / BUILD Phase 5 / @BLOCK

## 分類
### SDID 框架（不要動）
task-pipe/ sdid-tools/ .agent/ sdid-monitor/

### SDID 管理的專案
ExamForge time-echo control-tower smart-assistant

### 非 SDID 管理
github_project simple-app 選股用/

## POC-FIX 進行中
ExamForge → iter-11/poc/textpoc.html, iter-11/poc/mupdf.mjs
```

---

## 字典（GEMS-Next）

SCAN 後產出 `.gems/specs/*.json`，每筆 function 記：

```json
{
  "PDF.Fetch": {
    "priority": "P1",
    "flow": "Load→Extract→Return",
    "steps": {
      "Load": "用 mupdf 讀取 PDF buffer",
      "Extract": "取出文字層",
      "Return": "回傳 string[]"
    },
    "targetFile": "src/lib/pdfExtractor.ts",
    "lastModified": "2026-02-27T10:30:00.000Z",
    "iterRef": "iter-11",
    "storyRef": "Story-11.1"
  }
}
```

`lastModified` 來源：fs.watch 觸發時間，精確到檔案實際變動，不依賴 commit。

---

## Log 體系

| 來源 | Log 檔名 |
|------|---------|
| POC-FIX SETUP | `poc-setup-{ts}.log` |
| POC-FIX VERIFY | `poc-verify-round{N}-{pass\|fail}-{ts}.log` |
| POC-FIX CONSOLIDATE | `poc-consolidation-log.md`（固定名，hub 讀用） |
| BUILD Phase 1-8 | `build-phase-{N}-Story-{X.Y}-{pass\|fail}-{ts}.log` |
| MICRO-FIX | `micro-fix-{pass\|fail}-{ts}.log` |
| SCAN | `scan-scan-{pass\|fail}-{ts}.log` |

### @SEARCH 指引（字典整合後新增）

字典上線後，BUILD log 的 `@TASK` 區塊加入 `@SEARCH`，讓 AI 不需要全域搜尋，直接定位：

```
@TASK
ACTION: 修復 Auth.Login 缺少 HASH_COMPARE step
FILE: src/modules/auth/auth-api.ts
@SEARCH: .gems/specs/auth-api.json → Auth.Login → L3-45
EXPECTED: [STEP] HASH_COMPARE 存在於函式內
```

AI 收到 log 後的動作：
1. 讀 `.gems/specs/auth-api.json` 的 `Auth.Login` 那筆（20 行以內）
2. 直接讀 `src/modules/auth/auth-api.ts` L3-45
3. 局部替換，不讀整個檔案

`@SEARCH` 格式：
```
@SEARCH: {字典路徑} → {函式 ID} → {行數範圍}
```

字典還沒上線時，`@SEARCH` 省略，AI 靠 `FILE` 欄位自己定位。向後相容，不破壞現有 log。

---

## 不做的事

- Task-Pipe 完整 PLAN Step 1-5（式微）
- POC-FIX 前置 gate（blueprint-gate / plan-validator）
- MICRO-FIX 強制監控
- session 包 iteration（Blueprint 流程才需要，先不動）
- Cynefin Check（POC-FIX 路線不做，原型驗證本身就是 domain 探索）
