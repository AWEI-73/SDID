# SDID 系統架構全景

> 版本: v4.1 | 更新: 2026-03-01
> 定位: SDID 框架的完整腳本地圖與功能說明，供人類閱讀與 AI session 導航

---

## 核心概念

SDID（Structured Iterative Development）是一套 **AI 協同開發框架**。
核心主張：與其靠 AI 記憶規格，不如讓規格存活在結構化 JSON 字典裡，
AI 每次進來讀字典就能精準施工，不依賴上下文傳遞。

```
規格草稿 → 路線選擇 → POC 驗證 → 字典生成 → BUILD 八關 → 字典同步
                                                     ↑            ↓
                                               AI 進入點 ← state-guide 讀字典
```

---

## 架構圖（含腳本功能說明）

```
╔══════════════════════════════════════════════════════════════════════╗
║                     SDID 系統架構全景  v4.1                          ║
╚══════════════════════════════════════════════════════════════════════╝

━━━ 層 0：AI 進入點 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ┌─────────────────────────────────────────────────────────────────┐
  │  sdid-tools/state-guide.cjs  ★Wave 2★                           │
  │                                                                 │
  │  AI 每次 session 開始執行的第一支腳本                            │
  │  自動組裝「指令包」，讓 AI 不需追問就知道在哪、做什麼            │
  │                                                                 │
  │  輸入（自動讀取，不需手動指定）：                               │
  │    .gems/iterations/{iter}/.state.json  → 流程位置              │
  │    .gems/function-index-v2.json         → 目標函式位置          │
  │    .gems/specs/*.json                   → 字典規格              │
  │    .gems/project-memory.json            → 歷史 pitfall          │
  │                                                                 │
  │  輸出五個區塊：                                                 │
  │    📍 現在在哪（路線 / phase / step / story / iter）            │
  │    📖 該讀什麼（腳本規則 / 字典規格 / 目標函式 + 行號）         │
  │    ⚠️  歷史提示（@PITFALL / @HINT，同步驟曾踩的坑）            │
  │    🎯 下一步（@NEXT_COMMAND，可直接複製執行的指令）             │
  │    🚫 施工紅線（@GUARD，allowedImports 白名單）                 │
  │                                                                 │
  │  用法: node sdid-tools/state-guide.cjs --project=ExamForge      │
  │        --iter=iter-11  --story=Story-11.1  --gems=PDF.Parse     │
  └─────────────────────────────────────────────────────────────────┘
                              │
              路線偵測（marker 文件識別）
              requirement-draft.md    → Blueprint
              requirement-spec.md     → Task-Pipe (LEGACY)
              poc-consolidation-log.md → POC-FIX
                              │
                              ▼

━━━ 層 1：路線路由 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  三條路線從「需求類型」分流，共用同一個 BUILD 八關卡

  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │   Blueprint      │  │   POC-FIX        │  │   MICRO-FIX      │
  │  (模糊需求)      │  │  (複雜/特化模組) │  │  (單函式微調)    │
  │                  │  │                  │  │                  │
  │ requirement-     │  │ poc-             │  │ 直接指定函式     │
  │ draft.md 為標    │  │ consolidation-   │  │ 不走完整 BUILD   │
  │                  │  │ log.md 為標      │  │                  │
  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
           │                     │                      │
  blueprint-expand.cjs  poc/step-1~5.cjs       micro-fix-gate.cjs
  ─ 讀草稿，展開成    ─ step-1: SETUP            ─ 掃 --changed 的
    結構化 blueprint    step-2: VERIFY (迭代)       函式，驗 GEMS 標
                        step-3: CONSOLIDATE         籤基本存在性
  blueprint-gate.cjs    step-4: BUILD 入口          + allowedImports
  ─ 15 項機械驗收     step-5: 報告                + 測試檔存在性
    (VSC/AC/層次)
                       ★ POC-FIX 沒有 PLAN 階段 ★
  blueprint-verify.cjs  POC 本身就是探索過程，
  ─ 逐行核對設計規則   整合後直接進 BUILD
    vs 已有程式碼
                       poc/step-1~5.cjs
  blueprint-shrink.cjs  ─ [LEGACY] Task-Pipe poc
  ─ 壓縮 blueprint      步驟，保留供特定場景
    → 錨點格式          但不主推

  draft-to-plan.cjs    plan/step-1~5.cjs
  ─ blueprint → 拆成   ─ [LEGACY] Task-Pipe plan
    tasks + stories      步驟，式微中

━━━ 層 2：字典品質門控 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Skill A 生成字典後、進 CYNEFIN/BUILD 之前的品質檢查點

  ┌─────────────────────────────────────────────────────────────────┐
  │  sdid-tools/spec-gate.cjs  ★Wave 3★                             │
  │                                                                 │
  │  SPEC-001  字典 schema 驗證                                     │
  │            必填欄位（priority/targetFile/lineRange）全存在       │
  │            P0 函式額外驗 flow/steps/deps/allowedImports/ac      │
  │                                                                 │
  │  SPEC-002  _index.json 格式驗證                                 │
  │            值必須是字串（"Domain.Action": "specs/xxx.json"）     │
  │            不可是物件                                            │
  │                                                                 │
  │  SPEC-003  index ↔ spec 雙向一致性                              │
  │            index 有的 gemsId 必須在 spec 存在，反之亦然          │
  │                                                                 │
  │  SPEC-004  $meta.manages 路徑存在性                             │
  │            字典管理的 targetFile 必須在磁碟上找得到              │
  │                                                                 │
  │  SPEC-005  lineRange 格式與邏輯                                 │
  │            必須是 L{n}-{m} 且 n ≤ m                             │
  │                                                                 │
  │  用法: node sdid-tools/spec-gate.cjs --project=ExamForge        │
  │        --fix-index  （自動補 _index.json 缺漏條目）              │
  └─────────────────────────────────────────────────────────────────┘

  cynefin-log-writer.cjs
  ─ 評估需求複雜度（Simple/Complicated/Complex/Chaotic）
    Complex → 建議拆 story 或降 level
    結果寫入 cynefin log，下游路由參考

━━━ 層 3：BUILD 八道關卡 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  task-pipe/runner.cjs
  ─ 統一入口，根據 --phase / --step / --story 呼叫對應 phase 腳本
    狀態寫入 .gems/iterations/{iter}/.state.json
    log 輸出到 .gems/iterations/{iter}/logs/

  phases/build/
  ├── phase-1.cjs  骨架檢查
  │   ─ 環境（node/npm/tsc）健在
  │     implementation_plan 格式合法
  │     src 目錄存在，關鍵檔案結構正確
  │
  ├── phase-2.cjs  標籤驗收（The Enforcer）  ← 呼叫 gems-scanner-v2
  │   ─ 掃 src，確保每個 P0/P1 函式都有 @GEMS 錨點
  │     有字典 → 走 v2（比對 dict 條目）
  │     無字典 → 走 v1（regex 掃 JSDoc）
  │     STUB-001 偵測：函式 body 空或只有 throw
  │
  ├── phase-3.cjs  測試腳本撰寫
  │   ─ 輸出測試模板，AI 根據 ac 欄位填充測試案例
  │
  ├── phase-4.cjs  Test Gate
  │   ─ 測試檔存在、import 被測函式正確
  │     @GEMS-TEST-FILE 指向的路徑存在性驗證
  │
  ├── phase-5.cjs  TDD 執行
  │   ─ npm test / npx jest，擷取結果
  │     失敗 → @BLOCKER，輸出失敗測試名稱
  │
  ├── phase-6.cjs  整合測試
  │   ─ 跨模組整合測試（可依 consolidation-log 範圍選擇性跳過）
  │
  ├── phase-7.cjs  整合檢查
  │   ─ 路由/模組匯出/依賴關係正確性
  │     circular dependency 偵測
  │
  └── phase-8.cjs  Fillback                  ← 呼叫 dict-sync
      ─ 產出 iteration_suggestions.json
        同步更新字典（呼叫 dict-sync.cjs）
        checkpoint 存入 build/ 目錄

━━━ 層 4：掃描 & 字典工具層 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  sdid-tools/

  gems-scanner-v2.cjs  ★Wave 3★
  ─ AST 掃描（TypeScript Compiler API，從目標專案動態載入）
    isFunctionNode：FunctionDecl / Method / Arrow / Interface /
                    TypeAlias / Class / VarDecl(箭頭函式)
    getLeadingComment：合併所有連續 // 注釋區塊（防止多行遺漏）
    雙格式解析：
      舊 JSDoc: GEMS: funcName | P0 | ✓✓ | sig | Story-X.Y | desc
      新 inline: // @GEMS [P0] Domain.Action | FLOW: A→B | L50-61
    gemsId 解析：新格式直接取 / 舊格式對比 _index.json shortName
    輸出：functions-v2.json（flat）+ function-index-v2.json（byFile/
          byPriority/byGemsId/byPhase2）
    用法: node sdid-tools/gems-scanner-v2.cjs --project=ExamForge

  dict-sync.cjs  ★Wave 3★
  ─ BUILD phase-8 後執行，把 AST 掃描結果回寫字典
    lineRange 同步：用 node.getStart()/getEnd() 取實際行號
                    覆蓋字典的佔位符（L1-1）
    status 同步：   只升不降（STATUS_RANK: ⬜<🔧<✓<✓✓）
                    舊 JSDoc ✓✓→✓✓ / ✓○→✓ / ○○→⬜
                    新 inline 格式不動 status
    同步後：自動呼叫 spec-gate 做品質驗證
    用法: node sdid-tools/dict-sync.cjs --project=ExamForge [--dry-run]

  spec-gate.cjs  ★Wave 3★（見層 2 說明）

  tag-shrink.cjs  ★Wave 2★
  ─ BUILD @PASS 後，把程式碼裡的完整 JSDoc 壓縮成一行錨點
    原本: /** GEMS: parseBuffer | P0 | ✓✓ | (buf)→... | Story-11.1 | 載入 PDF */
    之後: // @GEMS [P0] PDF.ParseBufferWithImages | FLOW: A→B | L589-653
          //   → .gems/specs/pdf-text-extractor.json
    完整資訊搬進字典 JSON，程式碼保持精簡

  blueprint-expand.cjs   ─ 草稿 → 結構化 blueprint JSON
  blueprint-gate.cjs     ─ 15 項機械驗收（VSC/AC/层次）
  blueprint-verify.cjs   ─ 設計規則逐行核對
  blueprint-shrink.cjs   ─ 壓縮 blueprint → 錨點
  draft-to-plan.cjs      ─ blueprint → tasks + stories
  micro-fix-gate.cjs     ─ MICRO-FIX 快速 gate
  cynefin-log-writer.cjs ─ 複雜度評估記錄
  lib/dict-schema.cjs    ─ 字典 JSON Schema 定義與驗證器

━━━ 層 5：共用基礎設施 (task-pipe/lib/shared/) ━━━━━━━━━━━━━━━━━━━━━━

  state-manager-v3.cjs
  ─ .gems/iterations/{iter}/.state.json 讀寫
    狀態機：POC-1 → PLAN-1 → BUILD-1 → ... → COMPLETE
    Story 追蹤（in-progress / completed）
    重試計數（≥3 次 → 標記需人工介入）
    detectActiveIteration()：自動找最新的 active iter

  project-memory.cjs
  ─ .gems/project-memory.json（append，最多 200 筆）
    getResumeContext()：最近 5 筆 + pitfall + token 統計
    getHistoricalHint()：同 phase/step 的歷史失敗記錄
    knownPitfalls：自動收集的「坑」字串陣列

  phase-registry-loader.cjs  ─ 載入 phase-registry.json，取流程順序
  project-type.cjs           ─ 偵測 TS/JS/GAS 專案類型
  backtrack-router.cjs       ─ 失敗時的回退路由邏輯
  error-handler.cjs          ─ 錯誤格式化與分類
  retry-strategy.cjs         ─ 重試策略（指數退避）
  taint-analyzer.cjs         ─ 分析修改範圍，決定哪些 phase 可跳過
  next-command-helper.cjs    ─ 生成 @NEXT_COMMAND 指令字串
  incremental-validator.cjs  ─ 只驗證本次修改的函式（增量驗證）
  src-path-resolver.cjs      ─ 解析 src 目錄路徑（支援多種專案結構）

━━━ 層 6：資料層 (.gems/) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ── 專案級（跨 iter 共用，持續更新）──

  .gems/specs/
  ├── _index.json              ★Wave 3★
  │   ─ gemsId → specFile 快速索引
  │     AI 施工先讀這個，定位字典分片後再讀完整規格
  │     格式: { "PDF.ParseBufferWithImages": "specs/pdf-text-extractor.json" }
  │
  └── pdf-text-extractor.json  （字典分片，每個模組一份）
      ─ 每筆 gemsId 包含：
        priority / status / signature / description
        targetFile / lineRange（dict-sync 自動維護）
        flow / steps（函式執行步驟）
        deps / depsRisk（依賴關係與風險）
        allowedImports（只允許引入的套件，state-guide 讀為 @GUARD）
        test / testFile（測試資訊）
        storyRef（屬於哪個 story，state-guide 用來過濾目標函式）
        ac（驗收條件，phase-3 測試模板的依據）

  .gems/function-index-v2.json  ★Wave 3★
  ─ gems-scanner-v2 的輸出，四個維度索引：
    byFile: 每個 .ts 檔有哪些 GEMS 函式
    byPriority: P0/P1/P2/P3 各有哪些函式
    byGemsId: gemsId → {file, line, flow, specFile, dictBacked}
    byPhase2: dict-spec（有字典）/ comment-only（只有注釋）

  .gems/functions-v2.json       ★Wave 3★
  ─ 完整 flat 陣列，包含 untagged 函式（無 GEMS 標籤的）
    phase-2 用來報告「未標籤函式數量」

  .gems/project-memory.json
  ─ 跨 Story 歷史記錄，最多 200 筆
    每筆: { iteration, phase, step, story, verdict, signal, summary, missing }
    summary.knownPitfalls: 曾踩的坑（自動提取）

  .gems/last_step_result.json
  ─ 最後執行的 step 結果
    { phase, step, verdict, timestamp, message, needsFix, fixHints }
    state-guide 的 fallback 資料源

  ── iter 級（每次迭代獨立）──

  .gems/iterations/iter-N/
  ├── .state.json           ─ 流程狀態（stories/retries/humanAlerts/flow）
  ├── logs/                 ─ 所有 phase 的 log（poc/plan/build/scan 全進這裡）
  │   ├── poc-step-1-pass-{ts}.log
  │   ├── build-phase-2-Story-N.M-error-{ts}.log
  │   └── scan-scan-pass-{ts}.log
  ├── poc/                  ─ POC 產物（特例，不是 log）
  │   ├── poc-consolidation-log.md  ← POC-FIX 路線識別標記
  │   ├── requirement_spec_iter-N.md
  │   └── （POC 原始檔案）
  ├── plan/                 ─ implementation_plan_Story-N.M.md
  └── build/                ─ checkpoint JSON / iteration_suggestions / Fillback md

━━━ 層 7：監控層 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  sdid-monitor/server.cjs
  ─ HTTP server（port 3737）
    fs.watch 監聽 .gems/ 和各專案目錄
    debounce 1.2s 後呼叫 update-hub.cjs
    POST /api/hub/rebuild 手動觸發
    GET  /api/hub          回傳 hub.json

  sdid-monitor/update-hub.cjs
  ─ 掃描所有已知專案目錄
    讀各專案 .gems/last_step_result.json + .state.json
    輸出 hub.json（機器讀）+ workspace-hub.md（AI 讀）
    workspace-hub.md 格式：
      ROADMAP 進度快照 / 各專案即時狀態 / SDID 框架邊界宣告

  sdid-monitor/index.html
  ─ 瀏覽器 Dashboard，polling hub.json 顯示各專案狀態

━━━ 測試 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  sdid-tools/__tests__/
  ├── skill-a/fixtures/
  │   ├── blueprint/            ★Wave 3 新增★
  │   │   ├── requirement-draft.md   ← Blueprint 路線識別標記
  │   │   └── .gems/specs/auth-service.json
  │   └── taskpipe/             ★Wave 3 新增★
  │       ├── requirement-spec.md    ← Task-Pipe 路線識別標記
  │       └── .gems/specs/meal-service.json
  ├── test-gate-v12.cjs         ─ blueprint-gate 主要邏輯測試
  ├── test-gate-budget.cjs      ─ iter budget 上限測試
  ├── test-cynefin-iter-budget.cjs ─ cynefin 觸發門檻測試
  ├── test-stub-001.cjs         ─ STUB-001 偵測測試
  ├── test-v21-features.cjs     ─ v2.1 新功能迴歸測試
  └── test-log-output-dryrun.cjs ─ log 輸出格式 dry-run 測試
```

---

## 快速用法參考

```bash
# AI Session 開始（最常用）
node sdid-tools/state-guide.cjs --project=ExamForge

# 字典品質檢查
node sdid-tools/spec-gate.cjs --project=ExamForge
node sdid-tools/spec-gate.cjs --project=ExamForge --fix-index  # 自動補 index

# AST 掃描（GEMS 標籤覆蓋率）
node sdid-tools/gems-scanner-v2.cjs --project=ExamForge

# BUILD 後字典同步
node sdid-tools/dict-sync.cjs --project=ExamForge --dry-run   # 預覽
node sdid-tools/dict-sync.cjs --project=ExamForge             # 實際同步

# 執行 BUILD
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-11.1

# 監控 Dashboard
node sdid-monitor/server.cjs   # http://localhost:3737
```

---

## 資料流

```
[程式碼 .ts]
     │
     ▼ gems-scanner-v2（AST）
[function-index-v2.json]──────────────────────────────┐
[functions-v2.json]                                   │
     │                                                │
     ▼ Skill A / 手動                                 │
[.gems/specs/*.json]──── spec-gate ──→ PASS/FAIL      │
[.gems/specs/_index.json]                             │
     │                                                │
     ▼ BUILD phase-1~7                                │
[程式碼實作完成]                                       │
     │                                                │
     ▼ phase-8 Fillback                               │
[dict-sync] ──→ lineRange 更新 ──→ [specs/*.json] ←──┘
             ──→ status 更新
             ──→ spec-gate 自動驗證
     │
     ▼
[state-guide]  ← 讀以上所有資料 → 輸出「指令包」
```

---

## 專案潛力分析

### 當前強項

**1. 字典架構（GEMS-Next）已成形**
`.gems/specs/*.json` 作為「函式規格的唯一真相源」，AI 讀字典施工，
不依賴上下文傳遞規格，理論上無限擴展不會失憶。

**2. 閉環品質保障**
`BUILD → dict-sync → spec-gate` 形成閉環：
實作完成 → 行號自動回填字典 → 品質驗證 → 下次 AI 進來讀到的是最新規格。

**3. AI 進入成本接近零**
`state-guide` 讓 AI 不需追問「現在做什麼」，5 秒讀完指令包就可施工。

---

### 可整合的方向

**A. MCP Server 化（高潛力）**
現在 `state-guide` 是 CLI，AI 需要手動執行。
若包裝成 MCP tool，Claude 進入對話時可自動呼叫：
```
tool: get_project_state  → 直接回傳 state-guide 的輸出
tool: get_function_spec  → 讀 .gems/specs/{gemsId}
tool: sync_dict          → 呼叫 dict-sync（phase-8 後自動）
```
這樣 AI 完全不需要知道腳本路徑，透過 MCP 直接取得結構化資料。

**B. Claude API + 自動化施工（中期）**
有了字典（specs）+ 行號（lineRange）+ 施工規則（allowedImports/ac），
可以寫一個 `auto-build.cjs`：
```
讀 spec → 生成施工 prompt → 呼叫 Claude API → 寫入程式碼 → 跑測試
```
字典提供的精確範圍（L589-653）讓局部替換可行，不需讀整個檔案。

**C. VS Code Extension / Cursor Plugin**
`function-index-v2.json` 有 file + lineRange，可以：
- 在 GEMS 函式旁顯示 spec 摘要（hover）
- 側邊欄顯示哪些函式是 ✓✓ / 🔧 / ⬜
- 點擊跳到對應 spec 字典

**D. CI/CD 整合**
`spec-gate` 已是無依賴的 CLI（exit 0/1）：
```yaml
# .github/workflows/gems-gate.yml
- run: node sdid-tools/spec-gate.cjs --project=.
  # PR 合入前確保字典品質
```
`gems-scanner-v2` 可作為 pre-commit hook，確保新函式有 GEMS 標籤。

**E. 多專案統一儀表板（已有雛形）**
`sdid-monitor` 已能掃多個專案，`workspace-hub.md` 已有格式定義。
缺的是：
- 各專案的 GEMS 覆蓋率（tagged / untagged 比例）
- 字典品質得分（spec-gate pass rate）
- 跨專案的 pitfall 共享（目前 pitfall 只在單專案內）

**F. 字典版本控制**
`specs/*.json` 現在沒有 diff 追蹤。
加上 `dict-changelog.json`（記錄每次 dict-sync 改了什麼），
可以回答「這個函式的規格在哪個 iter 改過」。

---

### 目前的缺口

| 缺口 | 影響 | 建議 |
|------|------|------|
| `@SEARCH` 未寫入 BUILD log | AI 修 bug 時還需要自己搜尋 | phase-2 log 加 `@SEARCH: .gems/specs/... → gemsId → L{n}-{m}` |
| `lastModified` / `iterRef` 未寫入 dict | 無法追蹤字典何時由哪個 iter 更新 | dict-sync 順帶寫入 |
| MICRO-FIX 路線識別 | state-guide 無法區分 MICRO-FIX | 加 `micro-fix-target.md` 作為標記 |
| Blueprint route 的 state-guide 輸出 | 沒有 story/phase 資訊（無 state.json）| Blueprint loop 需寫入 state.json |
| 跨專案 pitfall 共享 | 每個專案獨立學習，不跨案 | workspace-hub 層面做 pitfall 聚合 |
```
