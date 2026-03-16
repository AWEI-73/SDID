---
name: sdid-flow-tester
description: SDID 流程稽核（Flow Audit）。當使用者說「flow audit」「流程稽核」「audit sdid」「跑 flow audit」「幫我稽核 SDID」「audit 一下」「跑稽核」時觸發。以全新測試專案為受試體，Claude 親自扮演開發者從頭跑完一次完整 SDID iter，真實執行每個 @TASK、遭遇每個 @BLOCK，從中觀察框架的使用摩擦與問題，最後寫稽核報告。不觸發：「測試」「unit test」「跑測試」「test」等（屬於 sdid-test runner）。
---

# SDID Flow Auditor

> 目的：用全新測試專案真實跑一次 SDID 流程，從開發者視角找出框架摩擦，寫稽核報告。

---

## 核心原則

**你是開發者，不是監控腳本。也不是框架維護者。**

每個步驟的 runner 輸出 `@TASK` 時，你要真的去做那件事（在 **temp 測試專案裡** 寫程式碼、建檔案、修 spec）。
`@BLOCK` 時分析原因、在測試專案裡修，然後重跑。

> ⚠️ **絕對禁止修改 SDID 框架本身的任何檔案**（`task-pipe/`、`sdid-tools/`、`.agent/` 等）。
> 遇到框架 bug → **記錄在報告裡**，不要修。稽核的目的是觀察問題，不是順手修 SDID。

---

## Step 1 — 建立測試專案

呼叫 MCP：

```
sdid-init-test-project(flow="taskpipe", type="todo")
```

回傳 `projectPath`（後續所有步驟都用這個路徑）。

---

## Step 2 — 真實跑完 iter-1

拿到 `projectPath` 後，照正常 SDID 流程推進：

```
sdid-loop(project=<projectPath>)
  → 讀輸出
  → @TASK → 執行（寫程式、建檔、改 spec）
  → @BLOCK → 分析原因、修復、重跑
  → @PASS  → 繼續呼叫 sdid-loop 推進
  → 直到 BUILD Phase 4 @PASS
```

**邊跑邊記錄**（心裡或草稿紀錄，不用每步都輸出給使用者）：

| 觀察點 | 說明 |
|--------|------|
| @TASK 指示是否清楚 | AI 需要猜測的地方就是問題 |
| @BLOCK 原因是否明確 | 不明確的 block 會浪費 AI 時間 |
| 步驟間的依賴是否自然 | 有沒有需要手動補的步驟 |
| 格式要求是否容易出錯 | spec 格式、plan 格式的易錯點 |
| 有沒有多餘的重複操作 | 同一件事要做兩次的情況 |

---

## Step 3 — 存稽核報告

流程跑完後，呼叫：

```
sdid-audit-save-report(
  projectPath=<projectPath>,
  keep=false,
  report=<下方格式的報告內容>
)
```

---

## 報告格式

```markdown
# SDID Flow Audit Report

**日期**: YYYY-MM-DD
**流程**: Task-Pipe
**結果**: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL

## 步驟觀察

| 步驟 | 結果 | 觀察摘要 |
|------|------|----------|
| POC Step 1 | ✅ | @TASK 清楚，直接完成 |
| POC Step 5 | ⚠️ | spec 格式說明不足，需猜測欄位 |
| PLAN Step 1 | ✅ | - |
| PLAN Step 2 | ✅ | - |
| BUILD Phase 1 | ⚠️ | VSC-002 ROUTE 判斷有歧義 |
| BUILD Phase 2 | ✅ | AC 過濾正確 |
| BUILD Phase 4 | ✅ | 一次 PASS，自動填 suggestions |

## 發現的問題

### [問題標題]
- **發生步驟**：[步驟名稱]
- **現象**：[描述 AI 實際卡住或困惑的情況]
- **根因推測**：[為什麼會這樣]
- **建議修復**：[具體方向]

## 整體評估

[1-3 段文字，從開發者視角評估這次跑流程的整體體感]

---
*稽核時間: {ISO timestamp}*
*測試專案: {projectPath}*
```

---

## 注意事項

- `keep=false` 跑完會自動清除 temp 專案（用 `keep=true` 可保留以便 debug）
- Blueprint 路線：改呼叫 `sdid-init-test-project(flow="blueprint")`，Step 2 從 Gate 開始
- 報告會自動存到 `.agent/skills/sdid-flow-tester/` 以便日後比較
