# Function Slicing Guide v1.0

## 概念

GEMS 標籤系統 v7.0 支援「分片讀取」，讓 AI 只讀取需要修改的函式，而非整個檔案。

**效益**：
- 省 Token（讀 30 行 vs 讀 500 行）
- 避免走歪（FLOW 約束實作步驟）
- 精確定位（行號索引）

---

## 檔案結構

SCAN 階段產出：

```
.gems/docs/
├── functions.json       # 完整函式清單（含行號）
├── function-index.json  # 快速索引（按檔案/優先級/Story）
├── schema.json          # 資料庫結構
└── tech-stack.json      # 技術棧
```

---

## functions.json 格式 (v7.0)

```json
{
  "name": "createTask",
  "file": "src/modules/kanban/KanbanService.ts",
  "startLine": 19,      // 函式開始行
  "endLine": 40,        // 函式結束行
  "commentLine": 11,    // GEMS 標籤所在行
  "lines": 22,          // 函式總行數
  "priority": "P0",
  "flow": "ValidateInput→DataStore.add→EventBus.emit→Return",
  "deps": "[Internal.Infrastructure.DataStore], [Internal.Infrastructure.EventBus]",
  "depsRisk": "MEDIUM",
  "storyId": "Story-3.0"
}
```

---

## AI 使用流程

### 1. 查詢函式位置

```
讀取 .gems/docs/function-index.json
找到目標函式: createTask
  → file: src/modules/kanban/KanbanService.ts
  → lines: "19-40"
```

### 2. 分片讀取

```
readFile("src/modules/kanban/KanbanService.ts", start_line=19, end_line=40)
```

只讀 22 行，而非整個檔案。

### 3. 修改時遵守 FLOW

```
FLOW: ValidateInput→DataStore.add→EventBus.emit→Return

修改必須保持這個流程順序：
1. ValidateInput - 驗證輸入
2. DataStore.add - 儲存資料
3. EventBus.emit - 發送事件
4. Return - 返回結果
```

### 4. 只能用 DEPS 裡的依賴

```
DEPS: [Internal.Infrastructure.DataStore], [Internal.Infrastructure.EventBus]

不能引入其他依賴，除非先更新 GEMS 標籤。
```

---

## function-index.json 用途

### 按檔案查詢

```json
"byFile": {
  "src/modules/kanban/KanbanService.ts": [
    { "name": "createTask", "lines": "19-40", "priority": "P0" },
    { "name": "getTasksByContext", "lines": "50-53", "priority": "P1" }
  ]
}
```

### 按優先級查詢

```json
"byPriority": {
  "P0": ["createTask", "handleAddSubmit", "parseSmartContent"],
  "P1": ["getTasksByContext", "updateTaskStatus", ...]
}
```

### 按 Story 查詢

```json
"byStory": {
  "Story-3.0": ["createTask"],
  "Story-1.3": ["getTasksByContext", "updateTaskStatus", "deleteTask"]
}
```

---

## 實際範例

### 任務：修改 createTask 的驗證邏輯

**傳統方式**：
```
1. 讀取 KanbanService.ts (200 行)
2. 找到 createTask
3. 修改
4. 輸出整個檔案
Token: ~800
```

**分片方式**：
```
1. 讀取 function-index.json
2. 找到 createTask: lines 19-40
3. readFile(..., start_line=19, end_line=40)
4. 修改 (遵守 FLOW)
5. strReplace 只替換那段
Token: ~100
```

**省 87.5% Token**

---

## 注意事項

1. **行號會變動** - 每次 SCAN 後更新
2. **FLOW 是契約** - 修改不能改變流程順序
3. **DEPS 是邊界** - 不能引入未宣告的依賴
4. **P0 函式** - 核心邏輯，修改需謹慎

---

## 指令參考

```bash
# 執行增強版掃描
node task-pipe/lib/scan/gems-scanner-enhanced.cjs src --output=.gems/docs

# 或透過 SCAN 階段
node task-pipe/runner.cjs --phase=SCAN --target=.
```
