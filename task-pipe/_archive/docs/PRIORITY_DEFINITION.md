# Priority 定義 v3.3

## 核心概念

Priority 不是「重要性」，而是「依賴複雜度」和「測試範圍」。

## 定義

| Priority | 名稱 | 定義 | 測試要求 |
|----------|------|------|----------|
| **P0** | 端到端流程 | 完整使用者流程：UI → 邏輯 → 儲存 → 回饋 | Unit + Integration + E2E |
| **P1** | 有依賴狀態 | 有 import，依賴其他模組/服務 | Unit + Integration |
| **P2** | 內部工具 | 純邏輯，無外部依賴，可獨立測試 | Unit |
| **P3** | 輔助函式 | 工具函式、格式化、常數等 | Unit (可選) |

## 判斷流程

```
函式有完整的 UI → 邏輯 → 儲存 → 回饋 流程？
├─ Yes → P0 (端到端)
└─ No → 函式有 import 其他模組？
         ├─ Yes → P1 (有依賴)
         └─ No → 函式是純邏輯計算？
                  ├─ Yes → P2 (內部工具)
                  └─ No → P3 (輔助函式)
```

## 範例

### P0 - 端到端流程
```typescript
/**
 * GEMS: createNote | P0 | ✓✓ | (input)→Note | Story-1.1 | 新增筆記完整流程
 * GEMS-FLOW: ValidateInput→SaveToStorage→UpdateUI→ReturnResult
 * GEMS-DEPS: [Internal.Storage], [Internal.Validator], [UI.NoteList]
 */
// 這是 P0 因為：
// 1. 接收使用者輸入 (UI)
// 2. 處理業務邏輯 (Validate)
// 3. 儲存資料 (Storage)
// 4. 更新畫面 (UpdateUI)
```

### P1 - 有依賴狀態
```typescript
/**
 * GEMS: validateNote | P1 | ✓○ | (input)→boolean | Story-1.1 | 驗證筆記
 * GEMS-DEPS: [Internal.Rules], [Internal.Types]
 */
// 這是 P1 因為：
// 1. 有 import 其他模組 (Rules, Types)
// 2. 但不是完整的端到端流程
```

### P2 - 內部工具
```typescript
/**
 * GEMS: formatDate | P2 | ✓○ | (date)→string | Story-1.0 | 格式化日期
 * GEMS-DEPS: []
 */
// 這是 P2 因為：
// 1. 純邏輯計算
// 2. 無外部依賴
// 3. 可獨立測試
```

### P3 - 輔助函式
```typescript
/**
 * GEMS: NOTE_STATUS | P3 | ✓○ | constant | Story-1.0 | 筆記狀態常數
 * GEMS-DEPS: []
 */
// 這是 P3 因為：
// 1. 只是常數定義
// 2. 無邏輯
```

## 分佈建議

一個典型的 Story 應該有：
- **P0**: 1-2 個（主要的端到端流程）
- **P1**: 3-5 個（支援 P0 的依賴函式）
- **P2**: 1-3 個（工具函式）
- **P3**: 0-2 個（常數、型別）

## 警告情況

| 情況 | 問題 | 建議 |
|------|------|------|
| P0 > 3 | P0 過多 | 重新評估，只有完整流程才是 P0 |
| P0 > P1 | 比例異常 | P0 應該依賴 P1，不應該比 P1 多 |
| 全部 P0 | 定義錯誤 | 不可能全部都是端到端流程 |
| 有 P0 無 P1 | 缺少依賴 | P0 端到端流程應該依賴 P1 函式 |

## 與 DEPS-RISK 的關係

| Priority | 典型 DEPS-RISK |
|----------|----------------|
| P0 | MEDIUM-HIGH（因為涉及多個模組） |
| P1 | LOW-MEDIUM（取決於依賴的模組） |
| P2 | LOW（無外部依賴） |
| P3 | LOW（無依賴） |
