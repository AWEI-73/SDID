---
name: sdid
description: SDID 統一開發框架 — 從需求設計到程式碼交付的完整流程。支援兩條設計路線：Blueprint（大藍圖 5 輪對話）和 Task-Pipe（POC 漸進式細部設計），兩條路匯流到 implementation_plan 後共用 BUILD Phase 1-8。觸發詞：「SDID」「藍圖」「blueprint」「新專案」「開發」「build」「繼續」「POC」「Task-Pipe」「快速建」「練習」「小專案」「create project」「new project」「繼續開發」「跑 build」「自動開發」「一鍵開發」「sdid 小修」「quick fix」「改一下」「fix」「小改」「micro fix」。
---

# SDID — 統一開發框架

## 路由判斷（進入 skill 後第一步）

根據專案狀態和使用者意圖，判斷進入哪個模式：

| 條件 | 模式 | 動作 |
|------|------|------|
| 使用者說「小修」「fix」「改一下」「quick fix」「micro fix」 | MICRO-FIX | escalation check → 直接改 → micro-fix-gate（見下方） |
| 無專案 + 使用者需求模糊 | DESIGN-BLUEPRINT | 讀 [references/blueprint-design.md](references/blueprint-design.md) → 5 輪對話 |
| 無專案 + 使用者需求明確 | DESIGN-TASKPIPE | 執行 `node .agent/skills/sdid/scripts/taskpipe-loop.cjs --new --project=[name]` |
| 有專案但無 draft + 使用者需求模糊 | DESIGN-BLUEPRINT | 讀 [references/blueprint-design.md](references/blueprint-design.md) → 5 輪對話（迭代號自動遞增） |
| 有專案但無 draft + 使用者需求明確 | DESIGN-TASKPIPE | 執行 `node .agent/skills/sdid/scripts/taskpipe-loop.cjs --project=[path]`（進入新迭代） |
| 有 draft，無 plan | BUILD-AUTO | 看 draft 類型自動選路線（見下方） |
| 有 implementation_plan | BUILD-AUTO | 自動偵測路線繼續 BUILD |
| 使用者說「快速建」「練習」「小專案」 | QUICKSTART | 執行 `node .agent/skills/sdid/scripts/taskpipe-loop.cjs --new --project=[name] --type=[type]` |

### Draft 類型自動判斷

```
draft 有 Enhanced Draft 格式標記（模組動作表、迭代規劃表）→ Blueprint 路線
  → 執行 node .agent/skills/sdid/scripts/blueprint-loop.cjs --project=[path]

draft 是簡單 requirement_draft → Task-Pipe 路線
  → 執行 node .agent/skills/sdid/scripts/taskpipe-loop.cjs --project=[path]
```

### 模糊意圖處理

使用者意圖不明時，問一個問題：
> 「你想從大方向開始設計（我會引導你 5 輪對話收斂需求），還是已經知道要做什麼想直接開始？」

不要問超過一個問題。不要自行讀檔案猜測。

---

## 模式鎖定 (Mode Lock)

進入任何模式後，嚴格遵守以下規則：

### 通用規則
1. 每完成一步，報告：「目前在 [模式] [步驟 N]，下一步是 [X]」
2. 使用者插入不相關請求時：先完成當前步驟，回報位置，處理完後回到斷點
3. 禁止讀取 `task-pipe/`、`sdid-tools/` 的 *.cjs 原始碼（工具內部與你無關）
4. 禁止對 `src/` 目錄使用全域 grep/search（迷路時的第一反應，會灌爆 context 引發幻覺）
5. 搜尋範圍限制：DESIGN-BLUEPRINT 模式必須限定在當前步驟的 ALLOWED-READ 檔案內；DESIGN-TASKPIPE 和 BUILD-AUTO 模式依腳本 output 指定的檔案操作

### MICRO-FIX 模式

**觸發條件**: 使用者說「小修」「fix」「改一下」「quick fix」「micro fix」等

**Escalation Check** (先判斷，再決定走哪條路):

| 信號 | 判斷 |
|------|------|
| "just", "fix", "改一下", "小改", 單一檔案/函式 | → 直接走 MICRO-FIX |
| 多個模組、架構調整、新功能、"重構" | → 升級到 SDID 正常流程 |

**MICRO-FIX 執行步驟**:
1. 確認要改什麼（一句話確認，不問多餘問題）
2. 直接修改檔案
3. 執行 gate 驗證：
   ```bash
   node sdid-tools/micro-fix-gate.cjs --changed=<改動的檔案> --target=<project>
   ```
4. `@PASS` → 完成
5. `@BLOCKER` → 根據輸出修復，重跑 gate

**不做的事**: 不寫測試、不跑完整 BUILD、不需要 story/plan

### DESIGN-BLUEPRINT 模式
- 讀 [references/blueprint-design.md](references/blueprint-design.md) 取得完整規則
- 第一步必須是問使用者問題，不是讀檔案
- 禁止讀取 src/*、.gems/*（設計階段不需要看程式碼）

### DESIGN-TASKPIPE 模式
- 讀 [references/taskpipe-design.md](references/taskpipe-design.md) 取得 POC-PLAN 規則
- 執行 `node .agent/skills/sdid/scripts/taskpipe-loop.cjs`，按 output 指示操作

### BUILD-AUTO 模式
- 讀 [references/build-execution.md](references/build-execution.md) 取得 BUILD 規則
- 執行對應的 loop script，按 output 指示操作
- 收到 @TASK 時直接修復，不要回讀 plan 或架構文件

### QUICKSTART 模式
- 用一句話確認使用者要建什麼，然後直接執行
- 如果使用者已經描述清楚，跳過確認直接執行

---

## 全授權模式

使用者說「全部授權」「自己跑」「你決定」時：

| 模式 | 行為 |
|------|------|
| DESIGN-BLUEPRINT | 內部推演 5 輪（每輪自己做決策不問使用者），最終一次性輸出完整 Enhanced Draft + 「下一步：啟動 BUILD」結論 |
| DESIGN-TASKPIPE | 直接執行 loop，按 output 操作 |
| BUILD-AUTO | 直接執行 loop，按 output 操作，@BLOCKER 時嘗試修復 |
| QUICKSTART | 直接執行，不確認 |

---

## 參考文件

| 文件 | 用途 | 何時讀取 |
|------|------|---------|
| [blueprint-design.md](references/blueprint-design.md) | Blueprint 5 輪對話規則 | 進入 DESIGN-BLUEPRINT 時 |
| [taskpipe-design.md](references/taskpipe-design.md) | POC-PLAN 漸進式規則 | 進入 DESIGN-TASKPIPE 時 |
| [build-execution.md](references/build-execution.md) | BUILD Phase 1-8 + 錯誤處理 | 進入 BUILD-AUTO 時 |
| [architecture-rules.md](references/architecture-rules.md) | 模組化架構規則 | Blueprint Round 3 或 PLAN Step 2 時 |
| [action-type-mapping.md](references/action-type-mapping.md) | 動作類型映射 | Blueprint Round 5 或 PLAN Step 4 時 |

## Prohibited Actions

| 禁止 | 原因 |
|------|------|
| 讀 *.cjs 原始碼 | 工具內部與你無關 |
| 跑 --help | SKILL.md 已有所有資訊 |
| 跳過設計步驟 | 每步建立在前一步之上 |
| 猜測需求 | 標記 [NEEDS CLARIFICATION] |
| 在 DESIGN 模式讀 src/ | 設計階段不看程式碼 |
