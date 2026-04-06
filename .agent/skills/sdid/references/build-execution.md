# BUILD 執行規則（兩條路線共用）

## 概覽

不管從 Blueprint 還是 Task-Pipe 進來，到了 implementation_plan 之後就是同一套 BUILD Phase 1-4（v6）。
兩條路線 BUILD 完成後收尾相同：都走 SCAN（sdid-loop 自動偵測）。

## 執行方式

使用 MCP `sdid-loop` tool（唯一入口，自動偵測路線）：

```
呼叫 MCP sdid-loop tool，project=[path]
```

`sdid-loop` 會自動偵測 Blueprint / Task-Pipe / POC-FIX 路線和 BUILD 進度，你不需要手動指定 phase。

> ⚠️ 舊的 `blueprint-loop.cjs` / `taskpipe-loop.cjs` 已 deprecated，不要使用。

## BUILD Phase 1-4（v6）

| Phase | 名稱 | 內容 |
|-------|------|------|
| 1 | 骨架映射層 | 讀 implementation_plan + contract_iter-N.ts，產出骨架 + GEMS 標籤全覆蓋（P0-P3） |
| 2 | TDD 驗收層 | 讀 contract_iter-N.ts 找 @TEST：有 → vitest --run（測試在 contract 階段寫好，Phase 1 RED，Phase 2 GREEN，不能動測試檔）；無 → tsc --noEmit（DB/UI 層只驗型別）|
| 3 | 整合層 | 路由整合、barrel export（Level S 跳過） |
| 4 | 標籤品質+Fillback層 | GEMS 標籤品質複查（全覆蓋）+ 產出 Fillback + iteration_suggestions |

> Level S 走 Phase 1→2→4（跳過 Phase 3）
> Level M/L 走 Phase 1→2→3→4

## 執行循環

1. 呼叫 MCP `sdid-loop` tool
2. 讀取 output：

### 收到 @PASS
- 直接再次呼叫 MCP `sdid-loop`（會自動進入下一階段）
- 不要自行組裝命令
- 不要讀額外檔案「確認一下」

### 收到 @TASK 區塊
- 直接根據 ACTION + FILE + EXPECTED 執行修復
- 禁止回讀 plan 文件或架構文件來「理解全貌」
- 只讀 @TASK 指定的 FILE 和 error log
- **例外**：@TASK 的 EXPECTED 含型別名稱但 FILE 裡找不到定義時，允許讀 `contract_iter-N.ts` 查型別簽名（僅此一個檔案，不讀 plan）

### Phase 2 找不到 contract.ts 或 @TEST
- 若 contract.ts 不存在：Phase 2 直接 BLOCK（contract-gate 應已通過）
- 若 contract.ts 存在但無 @TEST：Phase 2 只跑 tsc --noEmit（正常，DB/UI Story）
- 若 @TEST 指向的測試檔不存在：Phase 2 BLOCK + 提示在 contract 階段補寫測試檔

### 收到 @TACTICAL_FIX
- 讀 output 指定的 error log
- 找 @TASK 區塊
- 修復後再次呼叫 MCP `sdid-loop`

### 收到 @BLOCKER
- 讀 error log
- 報告給使用者，等指示
- 全授權模式下：嘗試修復，連續 3 次失敗才報告

## 錯誤處理策略

| 重試次數 | 策略 | 行動 |
|---------|------|------|
| 1-3 次 | TACTICAL_FIX | 局部修補，在原檔案修復 |
| 4-6 次 | STRATEGY_SHIFT | 換方式實作，考慮重構 |
| 7+ 次 | PLAN_ROLLBACK | 質疑架構，回退 PLAN 階段 |

## BUILD 完成後

BUILD Phase 4 完成後，再次呼叫 MCP `sdid-loop`，它會自動偵測下一步（下一個 Story 的 BUILD 或 SCAN）。Blueprint 與 Task-Pipe 路線收尾相同，都進入 SCAN。

## 禁止事項

| 禁止 | 原因 |
|------|------|
| 修改 task-pipe/ 目錄 | 工具程式碼是唯讀的 |
| 偽造 POC 產物 | POC 必須反映真實需求 |
| 跳步驟 | 每步驗證前一步的工作 |
| 在 @TASK 存在時讀 plan | 腳本已完成分析，直接執行 |

## Log 檔案位置

所有 log 在 `.gems/iterations/iter-X/logs/`：
- `poc-step-N-{pass|error}-*.log` — POC 結果
- `plan-step-N-{pass|error}-*.log` — PLAN 結果
- `build-phase-N-Story-X.Y-{pass|error}-*.log` — BUILD 結果
- `gate-check-{pass|error}-*.log` — Blueprint Gate 結果
- `gate-verify-{pass|error}-*.log` — Verify 結果
- `scan-{pass|error}-*.log` — SCAN 結果
