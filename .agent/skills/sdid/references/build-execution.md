# BUILD 執行規則（兩條路線共用）

## 概覽

不管從 Blueprint 還是 Task-Pipe 進來，到了 implementation_plan 之後就是同一套 BUILD Phase 1-8。
差異只在 BUILD 完成後的收尾：Blueprint 走 SHRINK→VERIFY，Task-Pipe 走 SCAN。

## 執行方式

根據進入路線，使用對應的 loop script：

```bash
# Blueprint 路線（有 Enhanced Draft）
node .agent/skills/sdid/scripts/blueprint-loop.cjs --project=[path]

# Task-Pipe 路線（沒有 Enhanced Draft）
node .agent/skills/sdid/scripts/taskpipe-loop.cjs --project=[path]
```

兩個 loop 都會自動偵測 BUILD 進度，你不需要手動指定 phase。

## BUILD Phase 1-8

| Phase | 名稱 | 內容 |
|-------|------|------|
| 1 | 骨架檢查 | 確保環境和檔案結構存在 |
| 2 | 標籤驗收 | 掃描 src 確保每個函數符合 GEMS 標籤 |
| 3 | 測試腳本 | 寫測試檔案 |
| 4 | Test Gate | 驗證測試檔案存在且 import 被測函式 |
| 5 | TDD 測試執行 | Unit/Integration 測試 |
| 6 | 修改檔案測試 | 整合測試 |
| 7 | 整合檢查 | 檢查路由、模組匯出等整合項目 |
| 8 | Fillback | 生成 Fillback + iteration_suggestions |

## 執行循環

1. 執行 loop script
2. 讀取 output：

### 收到 @PASS
- 執行 output 裡的 @NEXT_COMMAND （**唯一例外**：若是 Blueprint 路線且完成 Phase 8，強制忽略此命令，改為重新執行 `blueprint-loop.cjs`）
- 不要自行組裝命令
- 不要讀額外檔案「確認一下」

### 收到 @TASK 區塊
- 直接根據 ACTION + FILE + EXPECTED 執行修復
- 禁止回讀 plan 文件或架構文件來「理解全貌」
- 只讀 @TASK 指定的 FILE 和 error log

### 收到 @TACTICAL_FIX
- 讀 output 指定的 error log
- 找 @TASK 區塊
- 修復後重新執行 loop

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

### Blueprint 路線
BUILD Phase 8 完成後，**忽略 output 的「下一步: SCAN」**。
重新執行 `blueprint-loop.cjs`，它會自動偵測下一步（SHRINK 或下一個 Story）。

**活藍圖狀態由 blueprint-shrink 自動維護，不需要手動更新：**

```
blueprint-loop.cjs 在 Phase 8 後自動執行 blueprint-shrink：
  → 主藍圖 iter-N: [CURRENT] → [DONE]
  → 主藍圖 iter-N+1: [STUB] → [CURRENT]（升格，帶 Fillback suggestions）
```

shrink 完成後，告知使用者：
「Iter-N 已完成並折疊。下一個 iter-(N+1) [{模組名}] 已升格為 [CURRENT]，可執行 BLUEPRINT-CONTINUE 展開。」

### Task-Pipe 路線
BUILD Phase 8 完成後，重新執行 `taskpipe-loop.cjs`，它會自動進入 SCAN。

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
- `gate-shrink-{pass|error}-*.log` — Shrink 結果
- `scan-{pass|error}-*.log` — SCAN 結果
