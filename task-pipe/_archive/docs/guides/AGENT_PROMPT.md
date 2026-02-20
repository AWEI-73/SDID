# GEMS Agent 執行指令

## 至高無上規則 (違反即失敗)

1. 禁止讀取 .cjs 原始碼
2. 禁止在 BUILD 前建立專案原始碼
3. 禁止跳過流程: POC -> PLAN -> BUILD
4. 禁止主動搜尋檔案: 只讀終端輸出
5. **[STEP] 錨點強制規則**: BUILD Phase 4 實作時，每個 P0/P1 函式的 [STEP] 錨點數量必須與 PLAN Step 2.6 的 GEMS-FLOW 步驟數一致

## 流程

POC (Step 1 -> 2 -> 3 -> 4 -> 5)
-> PLAN (Step 1 -> 2 -> 3 -> 4 -> 5)
-> BUILD (Phase 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8，按 Level)

## [STEP] 錨點規則 (v2.3 新增)

**核心原則**: PLAN 承諾的每個 FLOW 步驟 = BUILD 實作的每個 [STEP] 錨點

### 範例

**PLAN Step 4 規格**:
```typescript
/**
 * GEMS-FLOW: ValidateContent→CreateObject→AddToCollection→SaveToStorage→Return
 *            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *            承諾: 5 個步驟
 */
```

**BUILD Phase 4 實作** (必須有 5 個 [STEP]):
```typescript
export function addNote(content: string, color: string): Note {
    // [STEP] ValidateContent
    if (!content.trim()) throw new Error('Content cannot be empty');

    // [STEP] CreateObject
    const newNote: Note = { ... };

    // [STEP] AddToCollection
    notes.unshift(newNote);

    // [STEP] SaveToStorage
    saveStorageNotes(notes);

    // [STEP] Return
    return newNote;
}
```

### 驗證機制

- **Phase 2**: 自動檢查 [STEP] 數量是否與 GEMS-FLOW 一致
- **Phase 8**: 在 Fillback 中記錄不一致項目
- **不符合**: 會觸發 TACTICAL_FIX 機制，最多 3 次機會

### 為什麼重要？

1. **Scanner 可驗證**: 確保「說到做到」
2. **可追溯性**: 每個邏輯步驟都有錨點
3. **維護性**: 清楚標記關鍵步驟
4. **團隊協作**: 提供清晰的代碼導航

## 開始

```bash
node task-pipe/runner.cjs --phase=POC --step=1 --target=.
```

執行後按 @OUTPUT 指示繼續。

## 終端輸出截斷處理

如果終端輸出被截斷或亂碼，查看 logs 目錄:

```
.gems/iterations/iter-X/logs/
```

Log 檔案類型:
- `*-pass-*.log` : 成功輸出 + 下一步指令
- `*-error-*.log` : 錯誤詳情 + 修復指示
- `*-template-*.log` : 模板內容

範例: `view_file(".gems/iterations/iter-1/logs/poc-step-1-pass-*.log")`
