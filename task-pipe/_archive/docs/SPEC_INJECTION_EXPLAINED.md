# 規格注入 (Spec Injection) 完全解析

## 🎯 核心概念

**規格注入 ≠ 實作程式碼**  
**規格注入 = 把 POC 的「藍圖」複製到 PLAN 文件中**

---

## 📊 資料流程圖

```
POC 階段 (Step 1-3)
├── Step 1: 契約設計
│   └── 產出: QuestionBankContract.ts
│       ├── @GEMS-CONTRACT: Question
│       ├── interface Question { ... }
│       ├── @GEMS-FUNCTION: createQuestion
│       └── @GEMS-SIGNATURE: (data) → Promise<Question>
│
└── Step 3: 需求規格
    └── 產出: requirement_spec_iter-1.md
        └── 定義功能範圍、Story 拆分

        ⬇️ 傳遞給 PLAN

PLAN 階段 (Step 2: 規格注入)
├── 讀取 POC 產出
│   ├── QuestionBankContract.ts
│   └── requirement_spec_iter-1.md
│
└── 產出: implementation_plan_Story-1.0.md
    └── Section 5: 規格注入 ← 🎯 這裡！
        ├── 5.1 資料契約 (@GEMS-CONTRACT)
        │   └── 把 Contract 內容「複製貼上」
        │
        └── 5.2 核心函式規格
            └── 把 @GEMS-FUNCTION 規格「複製貼上」

        ⬇️ 傳遞給 BUILD

BUILD 階段 (Phase 1-7)
├── 讀取 implementation_plan_Story-1.0.md
│   └── 從 Section 5 取得規格
│
└── 產出: src/storage.js ← 實際程式碼
    └── class QuestionStore {
          createQuestion(data) {
            // 根據注入的規格實作
          }
        }
```

---

## 🔍 為什麼需要「注入」？

### 問題：BUILD Agent 的視野限制

```
❌ 沒有規格注入:
BUILD Agent 讀取 → implementation_plan_Story-1.0.md
                 → 「要實作 QuestionStore，但不知道有哪些方法」
                 → 需要去找 POC 產出
                 → 但 BUILD Agent 不知道 POC 檔案在哪裡
                 → 只能猜測或問人類

✅ 有規格注入:
BUILD Agent 讀取 → implementation_plan_Story-1.0.md
                 → Section 5: 規格注入
                 → 看到完整的 @GEMS-CONTRACT
                 → 看到所有 @GEMS-FUNCTION 規格
                 → 直接開始實作，不需要找其他檔案
```

### 核心原則：單一真相來源 (Single Source of Truth)

**PLAN 文件 = BUILD Agent 的唯一輸入**

- ✅ BUILD Agent 只需讀一個檔案
- ✅ 所有規格都在 PLAN 文件中
- ✅ 不需要跨檔案尋找資訊

---

## 📝 實際範例對照

### POC 產出 (QuestionBankContract.ts)

```typescript
// @GEMS-CONTRACT: Question
// @GEMS-TABLE: tbl_questions
interface Question {
    id: string;              // UUID, PK
    type: QuestionType;      // ENUM('MULTIPLE_CHOICE','FILL_IN_BLANK','SHORT_ANSWER'), NOT NULL
    content: string;         // TEXT, NOT NULL
    answer: string;          // TEXT, NOT NULL
    difficulty: Difficulty;  // ENUM('EASY','MEDIUM','HARD'), NOT NULL
    subject: string;         // VARCHAR(100), NOT NULL
    tags: string[];          // JSON
    createdAt: number;       // TIMESTAMP, NOT NULL
    updatedAt: number;       // TIMESTAMP, NOT NULL
}

// @GEMS-FUNCTION: createQuestion
// @GEMS-SIGNATURE: (data: CreateQuestionInput) → Promise<Question>
// @GEMS-PRIORITY: P0
// @GEMS-FLOW: Validate→GenerateId→Save→Return
export type CreateQuestionInput = Omit<Question, 'id' | 'createdAt' | 'updatedAt'>;
```

### PLAN 文件 (implementation_plan_Story-1.0.md)

```markdown
## 5. 規格注入

### 5.1 資料契約 (@GEMS-CONTRACT)

\`\`\`typescript
// @GEMS-STORY: Story-1.0
// @GEMS-CONTRACT: Question
// @GEMS-TABLE: tbl_questions
interface Question {
    id: string;              // UUID, PK
    type: QuestionType;      // ENUM('MULTIPLE_CHOICE','FILL_IN_BLANK','SHORT_ANSWER'), NOT NULL
    content: string;         // TEXT, NOT NULL
    answer: string;          // TEXT, NOT NULL
    difficulty: Difficulty;  // ENUM('EASY','MEDIUM','HARD'), NOT NULL
    subject: string;         // VARCHAR(100), NOT NULL
    tags: string[];          // JSON
    createdAt: number;       // TIMESTAMP, NOT NULL
    updatedAt: number;       // TIMESTAMP, NOT NULL
}
\`\`\`

### 5.2 核心函式規格

\`\`\`typescript
// @GEMS-FUNCTION: createQuestion
// @GEMS-SIGNATURE: (data: CreateQuestionInput) → Promise<Question>
// @GEMS-PRIORITY: P0
// @GEMS-FLOW: Validate→GenerateId→Save→Return
\`\`\`
```

**看到了嗎？內容幾乎一模一樣！這就是「注入」**

---

## 🎯 注入的內容

### 必須注入的項目

#### 1. 資料契約 (@GEMS-CONTRACT)

```typescript
// @GEMS-CONTRACT: EntityName
// @GEMS-TABLE: tbl_table_name
interface EntityName {
  id: string;           // UUID, PK
  fieldName: string;    // VARCHAR(100), NOT NULL
  status: EntityStatus; // ENUM('DRAFT','ACTIVE')
}
```

**為什麼重要？**
- BUILD Agent 根據這個生成資料結構
- DB 型別註解 (`UUID, PK, VARCHAR(100)`) 用於推導 Schema
- 欄位註解 (`NOT NULL`) 用於驗證邏輯

#### 2. 核心函式規格 (@GEMS-FUNCTION)

```typescript
// @GEMS-FUNCTION: functionName
// @GEMS-SIGNATURE: (input: InputType) → Promise<OutputType>
// @GEMS-PRIORITY: P0
// @GEMS-FLOW: Step1→Step2→Step3
```

**為什麼重要？**
- BUILD Agent 根據這個生成函式骨架
- `GEMS-FLOW` 定義實作步驟
- `GEMS-PRIORITY` 決定實作順序

#### 3. 枚舉與型別定義

```typescript
enum QuestionType {
    MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
    FILL_IN_BLANK = 'FILL_IN_BLANK',
    SHORT_ANSWER = 'SHORT_ANSWER'
}
```

**為什麼重要？**
- 確保 BUILD Agent 使用正確的型別
- 避免拼寫錯誤或不一致

---

## ❌ 常見誤解

### 誤解 1: 規格注入 = 寫程式碼

```
❌ 錯誤理解:
「規格注入」就是在 PLAN 階段寫好程式碼，BUILD 階段直接複製

✅ 正確理解:
「規格注入」只是把「藍圖」(Contract) 複製到 PLAN 文件
BUILD 階段根據藍圖「實作」程式碼
```

### 誤解 2: 已經有 Contract 檔案了，為什麼還要注入？

```
❌ 錯誤理解:
POC 已經產出 QuestionBankContract.ts，BUILD Agent 直接讀就好

✅ 正確理解:
BUILD Agent 只讀 implementation_plan_Story-1.0.md
如果規格不在 PLAN 文件中，BUILD Agent 找不到
```

### 誤解 3: 注入就是複製貼上，沒有意義

```
❌ 錯誤理解:
注入只是複製貼上，浪費時間

✅ 正確理解:
注入是「資訊傳遞」的關鍵步驟
確保 POC → PLAN → BUILD 的資訊流暢通
```

---

## 🔧 實際操作步驟

### Step 1: 找到 POC 產出

```bash
# 找 Contract 檔案
ls [project]/.gems/iterations/iter-1/poc/*Contract.ts

# 找 Requirement Spec
ls [project]/.gems/iterations/iter-1/poc/requirement_spec_iter-1.md
```

### Step 2: 讀取 Contract 內容

```bash
# 讀取 Contract
cat [project]/.gems/iterations/iter-1/poc/QuestionBankContract.ts
```

### Step 3: 複製到 PLAN 文件的 Section 5

```markdown
## 5. 規格注入

### 5.1 資料契約 (@GEMS-CONTRACT)

\`\`\`typescript
// 把 Contract 內容貼在這裡
\`\`\`

### 5.2 核心函式規格

\`\`\`typescript
// 把 @GEMS-FUNCTION 規格貼在這裡
\`\`\`
```

### Step 4: 驗證注入是否完整

```bash
# 驗證 PLAN Step 2
node task-pipe/runner.cjs --phase=PLAN --step=2 --target=[project] --story=Story-1.0
```

**通過標準**: 輸出包含「規格注入: ✓」

---

## 📊 注入前後對比

### ❌ 沒有注入（驗證失敗）

```markdown
## 5. 規格注入

（空白或只有簡單描述）
```

**驗證結果**:
```
❌ 缺少規格注入
Step 2 未完成，缺: 規格注入
```

### ✅ 有注入（驗證通過）

```markdown
## 5. 規格注入

### 5.1 資料契約 (@GEMS-CONTRACT)

\`\`\`typescript
// @GEMS-CONTRACT: Question
interface Question {
  id: string;
  content: string;
  // ...
}
\`\`\`

### 5.2 核心函式規格

\`\`\`typescript
// @GEMS-FUNCTION: createQuestion
// @GEMS-SIGNATURE: (data) → Promise<Question>
\`\`\`
```

**驗證結果**:
```
✅ 規格注入: 通過
Step 2 已完成
```

---

## 🎓 總結

### 規格注入的本質

| 項目 | 說明 |
|------|------|
| **是什麼** | 把 POC 的契約 (Contract) 複製到 PLAN 文件的 Section 5 |
| **為什麼** | 讓 BUILD Agent 只需讀一個檔案就能取得所有規格 |
| **怎麼做** | 複製 `@GEMS-CONTRACT` 和 `@GEMS-FUNCTION` 到 PLAN |
| **驗證** | `node task-pipe/runner.cjs --phase=PLAN --step=2` |

### 關鍵原則

1. **單一真相來源**: PLAN 文件 = BUILD Agent 的唯一輸入
2. **資訊傳遞**: POC → PLAN → BUILD 的橋樑
3. **不是實作**: 只是藍圖，不是程式碼

### 記憶口訣

```
POC 畫藍圖 (Contract)
PLAN 注入藍圖 (Injection)
BUILD 根據藍圖蓋房子 (Implementation)
```

---

**最後更新**: 2026-01-08  
**相關文檔**: 
- [PLAN Step 2 檢查清單](./PLAN_STEP2_CHECKLIST.md)
- [GEMS Flow 指南](../../.kiro/steering/gems-flow.md)
