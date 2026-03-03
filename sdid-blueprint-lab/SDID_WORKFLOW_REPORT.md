# SDID Blueprint Lab - 流程復盤與問題發現報告 (Iter-1)

本文件摘要了在 `sdid-blueprint-lab` 建立過程中，為了達到與 `ExamForge` 同等級藍圖品質所執行的流程、Call MCP 的順序，以及發現的系統性問題。

---

## 🚀 執行流程與 MCP 順序

為了將專案從「簡易藍圖」提升至「標準活藍圖」，我執行了以下 MCP 與工具調用順序：

1.  **狀態診斷** (`mcp_sdid_sdid-state-guide`)
    *   確認當前專案處於 `iter-1` 的 `Story-1.0` 待命狀態。
2.  **藍圖重構** (`write_to_file`)
    *   參考 `sdid-tools/task-pipe/templates/enhanced-draft-golden.template.v2.md`。
    *   將 `requirement_draft.md` 全面升級為 V2.1 格式（含變異點分析、族群識別、路由結構）。
3.  **藍圖門控校驗** (`run_command: blueprint-gate.cjs`)
    *   驗證 `Level S` 的動作預算（Budget-001）、垂直切片完整性（VSC-002）與 AC 格式。
4.  **計畫生成** (`run_command: draft-to-plan.cjs`)
    *   從藍圖機械式轉換出 `implementation_plan_Story-1.0.md`，供後續開發與測試。
5.  **字典生成與修補** (`mcp_sdid_sdid-spec-gen` -> `multi_replace_file_content`)
    *   使用 `spec-gen` 初步產出 JSON 字典。
    *   **手動修復**：`spec-gen` 產出的 ` signature` 與 `ac` 通常是佔位符，無法過 Gate。我手動補齊了 `storyRef`, `targetFile`, `lineRange` (需為 L1-5 格式) 與 Given/When/Then。
6.  **字典門控驗收** (`mcp_sdid_sdid-spec-gate`)
    *   確保 `_index.json` 與各模組 `*.json` 雙向核對通過。
7.  **源碼標籤對齊** (`mcp_sdid_sdid-scanner` -> `write_to_file`)
    *   在實體程式碼中（`core-types.ts`, `storage-service.ts`）加入 `// @GEMS` 單行標籤。
    *   重新執行 `scanner` 確保覆蓋率從 0% 提升至可追蹤狀態。

---

## 🔍 發現的問題與解決方案

### 1. 生成與驗證的「間隙 (Gaps)」
*   **問題**：`spec-gen.cjs` 生成的字典內容太過精簡（只有 P2 預設值），直接執行 `spec-gate.cjs` 會爆出數十個 Error（缺少 `storyRef`, `targetFile` 等）。
*   **發現**：Gate 要求的 `lineRange` 必須是 `L1-10` 格式，但生成器常給出 `[1, 10]` 陣列。
*   **解決**：AI 在執行 `spec-gen` 後，必須立刻介入進行「字典精修 (Dict Polishing)」，將 `targetFile` 與 `signature` 補完。

### 2. Scanner 的匹配邏輯
*   **問題**：僅使用 `// @GEMS-FUNCTION` 註解塊有時無法被 `sdid-scanner` 正確關聯到字典。
*   **解決**：必須補上單行 `// @GEMS [Priority] GEMS_ID | FLOW | LineRange` 標籤，才能達到 100% 的 dict-backed 關聯。

### 3. AC (Acceptance Criteria) 的正規表達式
*   **問題**：`spec-gate` 對 AC 的檢查非常嚴格，必須在同一字串內包含 `Given`, `When`, `Then` (不限大小寫)。
*   **發現**：多行條目若被 parser 拆散，會導致 `gwt < 2` 的警告。
*   **解決**：將 AC 寫成單行完整的 BDD 語句。

### 4. 路由結構的一致性
*   **問題**：藍圖定義的 `$meta.manages` 若路徑不存在，會導致 `SPEC-004` 失敗。
*   **解決**：在跑 Gate 之前，必須先執行 `mkdir` 或 `touch` 建立骨架目錄/檔案。

---

## 🛠️ 下一步建議樣板 (SOP)

若要快速讓一個新專案達到此品質，建議 Call 順序：
1. `blueprint-gate` (確保 Draft 合法)
2. `draft-to-plan` (生成任務清單)
3. `spec-gen` (生成字典胚胎)
4. **AI 手動對齊** (修補檔名、ID、AC、LineRange)
5. `spec-gate` (最後驗收)
6. **建立 src 骨架並標記 GEMS** (對齊 Scanner)

---
**Reported by**: Antigravity AI
**Date**: 2026-03-03
