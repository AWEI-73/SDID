---
name: global-scan
description: 全域掃描與標籤門控。觸發詞：「全域掃描」「global scan」「掃一下標籤」「跑全域掃描」「更新全域標籤」。用於執行專案全域掃描，確保所有 GEMS 標籤 (特別是 P0/P1) 都有填寫必備的屬性 (FLOW, DEPS 等)。
---

# Global Scan (全域標籤門控)

當使用者要求「全域掃描」、「掃一下專案的標籤」、「跑 global scan」時，觸發此技能。

## 執行步驟

1. **確認目標專案路徑**：
   如果對話情境中已經有明確的當前專案 (例如 `ExamForge`)，則預設使用當前專案的路徑。
   路徑通常為：`c:\Users\user\Desktop\SDID\<ProjectName>`

2. **執行掃描指令**：
   請在終端機中，以工作區根目錄 (例如 `c:\Users\user\Desktop\SDID`) 為當前路徑 (`Cwd`)，執行以下指令：
   ```bash
   node .agent/skills/global-scan/scripts/global-tag-gate.cjs --target=<目標專案絕對路徑>
   ```
   *若是想查看「沒有被打上任何 GEMS 標籤」的函式清單，可以加上 `--show-untagged` 參數：*
   ```bash
   node .agent/skills/global-scan/scripts/global-tag-gate.cjs --target=<目標專案絕對路徑> --show-untagged
   ```

3. **解讀結果並回報**：
   - **如果結果為 `@BLOCKER`**：全域標籤有缺失內容 (沒填的要補)。請條列出缺少標籤內容的檔案和函式，並可以直接提供輔助修復的建議，或者按使用者的指示去幫忙補齊那些檔案的 GEMS 標籤 (例如補上 `GEMS-FLOW` 或 `GEMS-DEPS-RISK`)。
   - **如果結果為 `@PASS`**：表示全域標籤都合乎規範。可以簡短回報查核了多少個函式並通過，如果有 `⚠️ WARN` (建議事項，如建議補上測試) 也可以稍微提醒使用者。

## 注意事項
- 全域掃描關注的是「有打 GEMS 標籤的函式，裡面的屬性是否完整」，它是發布前、或開發段落收尾時的好幫手。
- 無需詢問使用者是否要跑，觸發此技能後請直接啟動指令。
