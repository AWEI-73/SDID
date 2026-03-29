# Gate: Contract BLOCKER 規則

適用階段：`contract_iter-N.ts` AI 語意擴充完成後，`contract-gate.cjs`（機械驗證）前

> **注意**：本 gate 做語意審查。機械格式驗證（tsc 編譯、tag 掃描）由 `contract-gate.cjs` 負責，兩者不重複。

---

## 前置：取得 needsTest 清單

執行語意審查前，需確認來自 `cynefin-report.json` 的 `needsTest:true` actions 清單。
若無法取得，假設所有 Complicated/Complex 域的 action 均為 `needsTest:true`。

---

## BLOCKER 條件

### B-CONTRACT-01：needsTest:true Action 缺 @GEMS-TDD
**條件**：`needsTest:true` 的 action 沒有對應的 `@GEMS-TDD` 路徑，或格式錯誤

**路徑格式規則**：
```
✅ 合法：src/modules/{Module}/{sub}/{function}.test.ts
❌ 違規：tests/{function}.test.ts（非 src/ 開頭）
❌ 違規：src/modules/{Module}/{function}.spec.ts（非 .test.ts 結尾）
❌ 違規：@GEMS-TDD 完全缺失
```

**範例違規**：
```typescript
// @GEMS-STORY-ITEM: calcNodeDate | LIB | P0 | CALC→VALIDATE→RETURN | 無
// needsTest:true — 但缺少 @GEMS-TDD
```

---

### B-CONTRACT-02：型別含 any / unknown / 裸 object
**條件**：interface 或 declare function 的參數/回傳型別含不具體型別

```
BLOCKER 關鍵字：any / unknown / object（裸用，非 Record<K,V>）
```

**範例違規**：
```typescript
getReport(id: string): any
createSession(data: object): Promise<any>
```

**合格範例**：
```typescript
getReport(id: string): TrainingReport
createSession(data: CreateSessionInput): Promise<SessionResult>
```

---

### B-CONTRACT-03：P0 寫入 Action 缺錯誤情境
**條件**：P0 優先級的寫入類 action（create / update / delete）沒有錯誤情境說明

**必要的錯誤情境**：

| action 類型 | 必要錯誤情境 |
|------------|------------|
| create | 空值/缺必填欄位 的錯誤處理 |
| update | 不存在 id 的錯誤處理 |
| delete | 不存在 id 的錯誤處理 |

**錯誤情境可出現在**：inline comment、`hiddenSteps`、或 `@GEMS-TDD` 測試案例描述

**豁免**（不觸發此規則）：
- 純計算 LIB（錯誤在測試檔）
- 查詢 action（空結果是正常狀態）
- UI / ROUTE action
- CONST 副作用函式

**範例違規**：
```typescript
// P0 createCourse — 無任何錯誤情境說明
export declare function createCourse(input: CreateCourseInput): Promise<Course>
```

---

### B-CONTRACT-04：命名與 Draft 不一致
**條件**：contract 的型別名稱 / interface 名稱與 draft 的實體名稱不符

**判斷**：
1. 列出 draft 中所有實體名稱（@GEMS-STORY-ITEM 的 entity column）
2. 對應找 contract 的 interface 或 type 名稱
3. 有差異（大小寫不同除外）→ BLOCKER

**範例違規**：
- Draft: `TrainingSession` → Contract: `Training`（缺 Session）
- Draft: `UserProfile` → Contract: `IUser`（命名完全不符）

---

### B-CONTRACT-05：CRUD/CALC STORY-ITEM 缺 @GEMS-WHY 或內容無意義
**條件**：CRUD 或 CALC 類型的 STORY-ITEM 沒有 `@GEMS-WHY`，或 WHY 只重複函式名稱

**BLOCKER 情境**：
```
缺失：CRUD/CALC STORY-ITEM 完全沒有 @GEMS-WHY 行
無意義：goal= 只寫函式名稱，無業務意圖
```

**範例違規**：
```typescript
// @GEMS-STORY-ITEM: createUser | API | P0 | ...
// @GEMS-WHY: goal=建立使用者 | guard= | fail=
//  ↑ goal 只重複函式語意，沒有說明業務價值
```

**合格範例**：
```typescript
// @GEMS-WHY: goal=讓管理員快速開通新成員帳號 | guard=email 不重複 | fail=409 衝突回饋給前端
```

**豁免**（不需要 @GEMS-WHY）：
- Foundation 層（CONST 定義、型別宣告）
- ROUTE / UI action

---

## 通過條件

以上五條全部未觸發 → @PASS，進入 `contract-gate.cjs` 機械驗證

---

## 輸出範例

```
## Design Review — contract_iter-1.ts

❌ BLOCKER (2)
  - [B-CONTRACT-01] calcNodeDate (needsTest:true) 缺 @GEMS-TDD 路徑
  - [B-CONTRACT-02] getReport 回傳型別為 any

@NEEDS_FIX — 重寫 contract_iter-1.ts 後再跑 design-review
```
