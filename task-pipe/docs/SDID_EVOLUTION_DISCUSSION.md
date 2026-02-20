# SDID 系統演進討論紀錄

> 日期: 2026-02-20
> 參與者: 開發者 × Opus (Kiro) × Gemini 3.1
> 狀態: 討論中，待下一輪收斂

---

## 一、架構診斷（Gemini 提出，Opus 審視）

### 痛點 1：狀態機物理化
- Gemini 指出 `detectProjectState` 靠 filesystem 爬梳 + regex 解析 log 時間戳來推導進度，脆弱且低效
- Opus 同意問題存在，但指出 filesystem 作為 single source of truth 在 AI 斷線/context 清空時是真正的救命繩
- 共識：問題不是用 filesystem，而是 filesystem 是「唯一」的狀態來源

### 痛點 2：AI 當 CLI 打字機
- Gemini 指出 AI 每步都在做「讀 output → 打下一個指令」的搬運工，零智慧含量但燒 token
- Opus 補充：這個搬運過程同時也是 AI 的 sanity check 機會，拿掉會讓 AI 介入時離根因更遠
- 共識：問題不是「AI 不該當打字機」，而是「AI 當打字機的時候能不能更快更便宜」

### 痛點 3：雙流程上下文割裂
- sdid-tools (Blueprint Flow) 和 task-pipe 靠 Markdown 檔案交握
- runner.cjs 身兼 Task-Pipe 和 Blueprint 兩條路線，fallback 邏輯越堆越多
- Opus 指出 Markdown 作為 API 的好處是人類可讀、可 debug，解法應該是拆分 runner 職責而非改通訊方式

---

## 二、進化方向（三輪討論收斂）

### ✅ P0：State Ledger（立刻做）
- 升級 `stateManagerV3` 為 primary source
- `.gems/iterations/iter-X/state.json` 成為唯一真理，O(1) 讀取
- Filesystem 退居 fallback recovery（state.json 損壞時才觸發）
- 改動量小、零風險、收益確定

### ✅ P1：Structured Output（漸進式做）
- 在 `--ai` 模式下，於現有 output 末尾附加 JSON summary
- 包含 `verdict`、`reason`、`contextFiles`、`agentInstruction`
- 不取代人類可讀的 output（開發者自己 debug 也需要看）
- 強化現有 `@TASK` 區塊的精準度（加行號、縮小範圍），不另起新標記

### ✅ P2：Facade Pattern 整併輸出函式（排進下一個 iteration）
- 將 10 個舊輸出函式整併為 emitFix/emitPass 等 4 個
- 保留舊函式名稱，內部 delegate 到新函式
- 分階段、零風險驗證

### ⏸️ 暫緩：Auto-Advance / Daemon 模式
- 背景 process 的 output 對 AI 可見，無法建立乾淨的隔離層
- AI 的 read 行為不完全可控，auto-advance 省的 token 會被「AI 在複雜 output 裡迷路」吃回去
- 等 AI IDE 有更好的 process 隔離機制再考慮

### ❌ 不做：Proof of Read (Tokenized Hash)
- 聰明但危險：AI 可能學會「只 grep hash 不讀內容」
- 增加硬性流程依賴，debug 複雜度上升
- 實作成本不低，ROI 不划算
- 現有 `@TASK` + `@FORBIDDEN` + steering 已覆蓋 80% 的「AI 不讀 log」問題

### ❌ 不做：統一 CLI 包裝 (sdid init/start/status)
- 主要使用者是 AI agent，不是人類在終端機打指令
- AI 不在乎指令好不好記，它在乎 output 能不能精準解析
- 零收益

### ❌ 不做：新增標記格式 (@READ / ACTION_ZONE)
- 系統已有 `@TASK`、`@NEXT_COMMAND`、`@FORBIDDEN`、`@TACTICAL_FIX`
- 再加新標記只會降低 AI 遵從率
- 正確做法：讓現有標記更精準，而非發明新機制

---

## 三、核心認知翻轉

> SDID 系統不是一套自動化 Pipeline，而是一套 AI 引導框架。

- Pipeline 思維 → 優化「跑更快」（auto-advance、daemon、batch）
- 引導框架思維 → 優化「每一步的引導更精準」（output 結構化、steering 更明確）
- AI 的 token 應該花在需要判斷力的地方（理解需求、修 bug、架構決策）
- 機械性驗證讓腳本自己處理，不需要佔 AI 的 context

---

## 四、SDID 統一架構（v2 修正）

### 核心認知修正

之前的方案把 SDID 拆成三個 skill（sdid-design / sdid-build / sdid-quickstart），
但這只是把「使用者需要知道內部概念」的問題從工具名稱搬到了 skill 名稱。

正確的模型：SDID 是一個統一系統，內部有兩條設計路線，匯流到同一個建造階段。

### 兩條設計路線

```
路線 A：Blueprint（大藍圖設計）
  適合：新系統、大方向模糊、需要從零收斂
  粒度：望遠鏡 — 看全局，快速收斂方向
  流程：5 輪對話 → Enhanced Draft → Gate → draft-to-plan
                                                  ↓
路線 B：POC-PLAN（細部漸進式 / 客製化設計）          ↓
  適合：需求明確、局部功能、細部調整               ↓
  粒度：顯微鏡 — 看細節，逐步驗證假設             ↓
  流程：POC Step 1-5 → PLAN Step 1-5              ↓
                                                  ↓
                                    ┌─────────────┘
                                    ↓
                          implementation_plan（匯流點 / 統一協定）
                                    ↓
                          BUILD Phase 1-8（共用建造階段）
                                    ↓
                          SCAN / SHRINK（驗證）
                                    ↓
                          iteration suggestions → 下一個 iter
```

### 匯流點：implementation_plan

這是兩條路線的統一協定。不管從 Blueprint 還是 POC-PLAN 進來，
到了 implementation_plan 格式一致，後面 BUILD 就接得上。

- Blueprint 路線：Enhanced Draft → Gate 驗證 → draft-to-plan 自動轉換 → implementation_plan
- POC-PLAN 路線：POC 產出 requirement_spec → PLAN 產出 → implementation_plan

### 路線判斷邏輯

使用者不需要知道「Blueprint」或「Task-Pipe」這些名詞。
SDID 根據情境自動判斷：

| 情境 | 路線 | 判斷依據 |
|------|------|---------|
| 全新系統、需求模糊 | Blueprint | 沒有 requirement_draft，使用者描述抽象 |
| 已有需求、局部功能 | POC-PLAN | 有明確的功能描述，或已有部分產物 |
| 已有 implementation_plan | 直接 BUILD | 偵測到 plan 檔案存在 |
| 已在 BUILD 中 | 繼續 BUILD | state.json 或 logs 顯示進度 |
| 快速練習 / demo | POC-PLAN (quick mode) | 使用者說「快速」「練習」「小專案」 |

### Skill 結構方案

一個統一的 SDID skill，內部包含兩條路線的引導：

```
.agent/skills/
└── sdid/                           ← 統一入口
    ├── SKILL.md                    ← Hub 路由 + Mode Lock
    ├── references/
    │   ├── blueprint-guide.md      ← 路線 A 的 5 輪對話規則
    │   ├── poc-plan-guide.md       ← 路線 B 的 POC-PLAN 規則
    │   ├── build-guide.md          ← 共用建造階段規則
    │   ├── architecture-rules.md   ← 模組化架構規則（現有）
    │   └── action-type-mapping.md  ← 動作類型映射（現有）
    └── scripts/
        ├── loop.cjs                ← sdid-loop proxy（Task-Pipe 路線）
        └── blueprint-loop.cjs      ← blueprint-loop proxy（Blueprint 路線）
```

### 使用者體驗（目標）

| 使用者說 | SDID 行為 |
|---------|----------|
| 「我想做一個系統」 | 問一個問題判斷路線 → 進入 Blueprint 或 POC-PLAN |
| 「使用 blueprint 模式」 | 直接進入 Blueprint 5 輪對話 |
| 「我要加一個功能」 | 進入 POC-PLAN 細部設計 |
| 「繼續」 | 讀 state → 從斷點接續（不管哪條路線） |
| 「全部授權」 | 自主模式，流程不跳但 AI 自己做決策 |
| 「快速建一個 app」 | POC-PLAN quick mode，最小對話直接開跑 |

### 與舊 skill 的對應

| 舊 skill | 歸入 SDID 的位置 | 處理方式 |
|---------|-----------------|---------|
| blueprint-architect | sdid/references/blueprint-guide.md | 5 輪對話規則遷入 |
| blueprint-loop | sdid/scripts/blueprint-loop.cjs | proxy 保留 |
| sdid-loop | sdid/scripts/loop.cjs | proxy 保留 |
| skill-creator | 不動 | 獨立 skill，與 SDID 無關 |

### 待確認
- SKILL.md 的 Mode Lock 要多細？（每步的 MUST/FORBIDDEN 清單 vs 簡化版）
- 舊 skill 目錄是否保留（deprecated 標記）還是直接刪除
- steering 的 task-pipe-flow.md 是否需要同步更新術語

---

## 五、實際使用痛點（開發者體感）

### 使用者的真實使用模式

開發者的典型操作：
- 說「使用 blueprint 模式」→ 期望進入對話式需求收斂
- 說「全部授權給你」→ 期望 AI 自主完成，但仍走完整流程
- 中途想修正方向 → 期望 AI 知道自己在哪，不要重新掃描
- 說「繼續」→ 期望從斷點接續，不要從頭來

### 根本問題：Hub 機制不存在

目前沒有一個真正的「入口引導」機制。使用者說「使用 blueprint 模式」時，AI 面對的是：
- 三個獨立 skill（blueprint-architect / blueprint-loop / sdid-loop）
- 沒有統一的入口判斷「你現在該進哪個 skill」
- 每個 skill 的 SKILL.md 都假設 AI 已經知道該做什麼

結果就是每次開頭都歪來歪去 — AI 不確定該問問題還是跑指令，所以它做了最安全的事：到處讀檔案「理解全貌」。

### 痛點 A：開頭接不上

使用者說「使用 blueprint 模式」後，AI 不知道該先問問題還是直接跑指令。

常見行為：跳過對話直接去讀專案檔案「理解全貌」，浪費 token 且偏離方向。

根因：
1. SKILL.md 沒有明確的「第一步必須做什麼」的強制指令
2. 沒有 hub 機制告訴 AI「blueprint 模式 = 先進 sdid-design，不是 sdid-build」
3. AI 的預設行為是「先理解再行動」，但 design 階段需要的是「先問再理解」

### 痛點 B：中間插入困難

AI 跑到一半使用者想修正方向，AI 不知道自己在流程的哪個位置。

常見行為：重新掃描專案狀態，又開始亂讀檔案。

根因：
1. 缺少「當前步驟」的錨定，AI 每次都從零推導
2. State Ledger 不存在（P0 待做），AI 只能靠 filesystem 猜
3. SKILL.md 沒有「中斷恢復」的指令（只有 sdid-loop 的 agent-prompt.md 有提到 interrupt handling，但太弱）

### 痛點 C：到處亂看

AI 沒有「此刻你只能看這些檔案」的約束，read 行為發散。

常見行為：跑去讀 plan 文件、架構文件、甚至工具原始碼（*.cjs）。

根因：
1. SKILL.md 的 Prohibited Actions 是全域的，沒有按步驟限定可讀範圍
2. AI 的 read 行為本質上不可控 — 這是 AI IDE 生態系的根本約束
3. 但可以透過更精準的「此步驟只需要這些檔案」來降低發散機率

### 痛點 D：全授權模式下品質不穩

使用者說「全部授權給你」時，AI 自己產 draft，但品質取決於它有沒有先問對問題。

根因：
1. blueprint-architect 的 5 輪對話設計是對的，但 AI 在全授權模式下會跳過對話直接產出
2. 「全授權」被 AI 理解為「不需要問問題」，但正確理解應該是「你自己做決策，但流程不能跳」
3. 需要明確區分「互動模式」和「自主模式」— 流程相同，只是決策者不同

---

## 六、解法：模式鎖定 (Mode Lock) 設計

### 核心概念

統一的 SDID skill 內部，根據使用者意圖和專案狀態，鎖定到對應的模式。
SKILL.md 必須明確告訴 AI：
1. 你現在在什麼模式（路線 A / 路線 B / BUILD）
2. 第一步必須做什麼（不是「可以做什麼」）
3. 每一步只能看什麼檔案
4. 中斷後怎麼恢復

### Hub 路由（SKILL.md 最頂層）

進入 SDID skill 後，AI 的第一個動作是判斷路線：

```
判斷順序：
1. 使用者明確指定 → 直接進入對應路線
   - 「blueprint」「藍圖」→ 路線 A
   - 「POC」「細部」「客製化」「加功能」→ 路線 B
   - 「繼續」「build」→ BUILD 模式

2. 使用者沒指定 → 問一個問題
   「你想從大方向開始設計（藍圖模式），還是針對具體功能做細部規劃？」

3. 已有產物 → 自動判斷
   - 有 implementation_plan 且無完成的 BUILD → BUILD 模式
   - 有 Enhanced Draft 但無 plan → 路線 A 接續（Gate → Plan）
   - 有 requirement_draft 但無 Enhanced Draft → 路線 B 接續
   - 什麼都沒有 → 問使用者（回到 2）
```

### 路線 A：Blueprint（大藍圖設計）Mode Lock

```
MODE: BLUEPRINT
角色: 望遠鏡 — 從零收斂大方向
產物: Enhanced Draft → Gate → draft-to-plan → implementation_plan

═══ 互動模式（預設）═══

STEP 1/5 — 目標釐清
  MUST: 問使用者「你想做什麼系統？解決什麼問題？誰會用？」
  FORBIDDEN-READ: src/*, .gems/*, task-pipe/*, *.cjs
  ALLOWED-READ: 無（此步驟只靠對話）
  EXIT: 使用者確認一句話目標 + 族群表

STEP 2/5 — 實體識別
  MUST: 問使用者「系統需要管理哪些資料？」
  FORBIDDEN-READ: src/*, task-pipe/*
  ALLOWED-READ: Step 1 的對話紀錄
  EXIT: 使用者確認實體表格

STEP 3/5 — 模組拆分
  MUST: 根據 Step 1-2 提出模組結構建議，問使用者確認
  FORBIDDEN-READ: src/*, task-pipe/*
  ALLOWED-READ: references/architecture-rules.md
  EXIT: 使用者確認模組結構

STEP 4/5 — 迭代規劃
  MUST: 提出 MVP 範圍建議，問使用者「第一版要做到什麼程度？」
  FORBIDDEN-READ: src/*, task-pipe/*
  ALLOWED-READ: references/action-type-mapping.md
  EXIT: 使用者確認迭代規劃表

STEP 5/5 — 動作細化 + 組裝
  MUST: 列出每個模組的具體動作 → 組裝 Enhanced Draft → 存檔
  FORBIDDEN-READ: src/*, task-pipe/*
  ALLOWED-READ: references/action-type-mapping.md, templates/enhanced-draft-golden.template.md
  EXIT: Draft 存檔 → 自動接 Gate → draft-to-plan → 產出 implementation_plan
        → 提示「設計完成，要開始建造嗎？」

═══ 全授權模式 ═══
觸發: 使用者說「全部授權」「自己跑」「你決定」
行為: 仍然走 5 步，但每步 AI 自己做決策，不問使用者。
差異: 5 步全部完成後一次性展示完整 Draft。
關鍵: 「全授權」≠ 跳流程，而是「AI 自己做決策但步驟不變」。
```

### 路線 B：POC-PLAN（細部漸進式設計）Mode Lock

```
MODE: POC-PLAN
角色: 顯微鏡 — 逐步驗證每個假設
產物: requirement_draft → requirement_spec → implementation_plan

═══ 啟動序列 ═══

STEP 0 — 執行 loop.cjs
  MUST: 執行 loop.cjs --project=[path]
  loop.cjs 會自動偵測狀態，輸出下一步指令（POC Step N 或 PLAN Step N）
  FORBIDDEN-READ: src/*, *.cjs 原始碼
  ALLOWED-READ: loop.cjs 的終端輸出

═══ POC 階段（Step 1-5）═══
  按 loop.cjs 輸出的 @NEXT_COMMAND 逐步執行
  每步的 runner.cjs 會輸出具體的 @TASK 或 @PASS
  AI 按指示操作，不自行跳步

═══ PLAN 階段（Step 1-5）═══
  同上，按 runner.cjs 輸出操作
  最終產出: implementation_plan（與路線 A 格式一致）
  EXIT: implementation_plan 產出 → 提示「設計完成，要開始建造嗎？」

═══ 全授權模式 ═══
行為: 直接執行 loop.cjs，按 output 指示操作，不問使用者
```

### BUILD 模式（共用建造階段）Mode Lock

```
MODE: BUILD
前提: 已有 implementation_plan（不管從路線 A 還是路線 B 來的）

═══ 啟動序列 ═══

STEP 0 — 狀態偵測
  MUST: 執行 loop.cjs --project=[path]
  loop.cjs 自動判斷:
    - 有 Enhanced Draft → 走 blueprint-loop（BUILD + SHRINK/VERIFY）
    - 沒有 → 走 sdid-loop（BUILD + SCAN）
  FORBIDDEN-READ: src/*, plan 文件, 架構文件, *.cjs 原始碼
  ALLOWED-READ: loop.cjs 的終端輸出

═══ 執行循環 ═══

ON @PASS:
  MUST: 執行 output 裡的 @NEXT_COMMAND
  FORBIDDEN: 自行組裝命令、讀額外檔案「確認一下」

ON @TACTICAL_FIX:
  MUST: 讀 output 指定的 error log → 找 @TASK → 按指示修復
  FORBIDDEN-READ: plan 文件、架構文件、其他 Story 的檔案
  ALLOWED-READ: @TASK 指定的 FILE 和 error log

ON @BLOCKER:
  MUST: 讀 error log → 報告給使用者 → 等指示
  FORBIDDEN: 自行嘗試修復 BLOCKER 級別的問題

═══ 全授權模式 ═══
行為: 直接執行，@BLOCKER 時嘗試 STRATEGY_SHIFT，連續 3 次失敗才報告

═══ 中斷恢復 ═══
1. 完成當前 phase 的修復循環
2. 回報「BUILD Phase N 進行中，處理完你的請求後繼續」
3. 處理完後執行 loop.cjs（從 state 讀取斷點）
```

### 中斷恢復（全域規則）

不管在哪個模式，中斷恢復的原則一致：
1. 回報當前位置：「目前在 [模式] [步驟]」
2. 處理使用者的插入請求
3. 回到斷點時，說明上次進度摘要
4. 不重新掃描、不重新讀檔案

---

## 七、下一步

### 立即可做（本輪）
1. 建立統一的 `.agent/skills/sdid/` 目錄
2. 寫入帶 Hub 路由 + Mode Lock 的 SKILL.md
3. 遷移現有 references 到 sdid/references/
4. 更新 steering 的 task-pipe-flow.md 同步術語
5. 舊 skill 目錄標記 deprecated

### 短期（下一輪）
6. 實作 P0 State Ledger（stateManagerV3 升級為 primary source）
7. loop.cjs 整合（自動偵測 blueprint vs task-pipe 路線）

### 中期
8. 漸進式實作 P1 Structured Output
9. Facade Pattern 整併輸出函式

### 驗證方式
- 用一個新專案測試路線 A（Blueprint 5 輪對話，互動 + 全授權各一次）
- 用一個新專案測試路線 B（POC-PLAN 細部設計）
- 用現有專案測試 BUILD 的中斷恢復
- 觀察 AI 的 read 行為是否被 Mode Lock 有效約束
