# GEMS 標籤完整指南 (Complete GEMS Tagging Guide)

> **版本**: v4.0  
> **日期**: 2026-03-09  
> **變更**: 測試策略改為 GEMS-FLOW + GEMS-DEPS 機械推導（ac-runner/jest-unit/jest-integ/poc-html/skip），移除 Priority-based 測試要求

## 1. 核心理念
GEMS 標籤系統用於標記代碼的 **優先級**、**狀態**、**依賴關係** 和 **測試覆蓋率**。它不僅協助開發者維護，更是 AI 助手 (如各類 IDE Copilot) 理解專案結構的關鍵索引。

### 1.1 標籤系統的階段性差異

GEMS 標籤在不同開發階段有不同的用途：

| 階段 | 標籤用途 | 檔案類型 |
|------|---------|---------|
| **POC** | 定義資料契約、標記 UI 區塊 | HTML, TSX (原型) |
| **PLAN** | 規劃實作順序、依賴關係 | Markdown (計畫文件) |
| **BUILD** | 標記優先級、測試狀態、依賴 | TS, JS (正式程式碼) |
| **SCAN** | 自動掃描、更新規格 | 所有程式碼檔案 |

> 📚 **POC 階段專用標籤**請參考 [POC 標籤策略指南](./poc-tagging-guide.md)

---

## 2. 基礎標籤格式 (通用)

所有函式、元件或 Hooks 必須包含第一行的基礎標籤。

```typescript
/**
 * GEMS: EntityName | P0 | ✓✓ | Input→Output | Story-X.X | 描述
 */
```

| 欄位 | 說明 | 範例 |
|------|------|------|
| `EntityName` | 函式/元件名稱 | `calculateMealCost`, `StudentList` |
| `P0-P3` | 優先級 | `P0` (核心) \~ `P3` (簡單) |
| `✓✓` | 狀態 | `✓✓` (完成且測試), `✓○` (完成未測) |
| `Input→Output` | 簽名描述 | 見下方「類型別簽名規範」 |
| `Story-X.X` | 關聯需求 | `Story-14.3` |

### 類型別簽名規範 (Input→Output)

| 類型 | 格式 | 範例 |
| :--- | :--- | :--- |
| **Function** | `(args)→Result` | `(record, rule)→number` |
| **Component** | `(props)→UI` | `({classId})→UI` |
| **Hook** | `(args)→{State, Methods}` | `(menuId)→{cost, update}` |
| **Async** | `(args)→Promise<T>` | `(id)→Promise<void>` |

---

## 2.1 風險等級判定矩陣 (v3.0)

> 🎯 **核心觀念**：Priority 決定函式重要性，測試策略由 GEMS-FLOW + GEMS-DEPS 機械推導，不靠 Priority。

| 等級 | 定義 | 判定準則 | 範例 |
|------|------|----------|------|
| **P0** | 核心/金流/不可失效 | 符合以下任一：❶ 涉及金錢計算 ❷ 資料刪除操作 ❸ 身分驗證 ❹ 無法 rollback | `processPayment`, `deleteUser`, `authenticate` |
| **P1** | 重要/CRUD主流程 | 符合以下任一：❶ 資料建立/更新 ❷ 業務核心展示 ❸ 跨模組呼叫 | `createOrder`, `updateProfile`, `syncModules` |
| **P2** | 輔助/低依賴 | 符合以下任一：❶ 純展示（只讀） ❷ 格式化工具 ❸ 模組內部輔助 | `formatDate`, `renderList`, `calculateAge` |
| **P3** | 簡單/無依賴 | 符合：❶ 純函數 ❷ 無任何外部依賴 ❸ 邏輯 <10 行 | `log`, `toUpperCase`, `isEmpty` |

### 指導原則（軟性警告）

- **P0 建議**：每個 Story 控制在 2-5 個
- **P1 建議**：每個 Story 控制在 5-10 個
- **核心指標**：P0 + P1 不應超過總函式的 50%

-----

## 3. 擴展標籤系統 (P0/P1 必備)

對於 P0/P1 的代碼，必須包含以下詳細資訊。

### 3.1 GEMS-FLOW (執行流程)

描述內部的執行步驟，使用 PascalCase 與箭頭。

```typescript
// 用於 Function
GEMS-FLOW: ValidateInput→CalculateCost→SyncToDatabase→Return

// 用於 Component (渲染流程)
GEMS-FLOW: CheckLoading→RenderHeader→RenderList(Map)→RenderPagination
```

#### 🎯 GEMS-FLOW 黃金法則

**核心觀念：地圖法則**
GEMS-FLOW 的目的不是「翻譯程式碼」，而是讓閱讀者在 **3 秒內** 建立「心理模型 (Mental Model)」。

```typescript
// ❌ 過度細節 (太痛苦)
GEMS-FLOW: InitState→EffectCheckLogin→IfLoginTrueFetchData→IfLoginFalseRedirect→RenderLoading→RenderData

// ✅ 高階抽象 (完美)
GEMS-FLOW: CheckAuth→FetchUserContext→RenderDashboard
```

**最佳實踐：**
- **顆粒度**: 3-5 個步驟為最佳，超過 7 個請考慮重構代碼或抽象化步驟
- **抽象化**: 用「Decide/Switch」、「Process/Handle」、「Render」來概括複雜的 if/else
- **分離**: 將 Render (渲染) 與 Handle (行為) 分開標記

#### 🔥 FLOW 顯性化規則：Hidden Mapper Trap

**問題**：DTO 轉換邏輯被隱藏在 `ReturnRecord` 中

```typescript
// ❌ 隱藏轉換 - 看不出有資料變形
GEMS-FLOW: ValidateInput→InsertDatabase→ReturnRecord

// 實際代碼有 10+ 行的 snake_case → camelCase 轉換
return {
  id: data.diner_id,
  dinerCode: data.diner_code,
  // ... 10+ fields mapping
};
```

**解法**：如果轉換邏輯超過 3 行，必須在 Flow 中明確標示

```typescript
// ✅ 方案 A: 誠實標記
GEMS-FLOW: ValidateInput→InsertDatabase→MapToDomainModel→Return

// ✅ 方案 B (更佳): 抽離成 Helper 並標記依賴
GEMS-DEPS: [internal] mapper.toTemporaryDinerDomain
return toTemporaryDinerDomain(data);
```

#### 🎭 React 元件的 Flow 分離模式

**痛點**：`RenderFields→OnSubmit→Validate→CallLoginHook→Redirect` 混合了「畫面渲染」與「使用者點擊」

**解法**：將 Component Flow 與 Event Handler Flow 分開

```typescript
/**
 * GEMS: LoginPage | P1 | ✓✓ | (props)→UI | Story-05 | 登入頁面
 * GEMS-FLOW: InitHooks→CheckAuthStatus→RenderLoginForm
 * (專注於：頁面怎麼跑出來)
 */
export const LoginPage = () => {
  /**
   * GEMS: handleSubmit | P1 | ✓✓ | (e)→void | Story-05 | 處理登入提交
   * GEMS-FLOW: ValidateForm→ExecuteLogin→RedirectOnSuccess
   * (專注於：按下按鈕後發生什麼)
   */
  const handleSubmit = async () => { ... }
  
  return <form onSubmit={handleSubmit}>...</form>
}
```

#### 📊 常見場景 Flow 寫法

| 場景 | ❌ 錯誤寫法 | ✅ 正確寫法 |
|------|-----------|-----------|
| **複雜分支** | `CheckUser→IfAdminRenderAdmin→IfTeacherRenderTeacher→ElseRenderStudent` | `CheckUser→RenderRoleBasedPanel` 或 `CheckUser→SwitchPanelByRole` |
| **迴圈處理** | `ForEachDay→CheckBreakfast→CheckLunch→CheckDinner→Sum` | `ValidateInput→GetConfig→CalculateWeeklyTotal→Return` |
| **資料轉換** | `Query→Return` | `Query→MapToDomain→Return` |

### 3.2 GEMS-DEPS (依賴關係) [v2.1 折衷格式]

明確標記依賴來源，這對偵測架構風險至關重要。

**格式**：`[Type.Name (簡短說明)]` 或 `[Type.Name]`

| Type 標籤 | 來源路徑 | 風險 | 說明 |
| :--- | :--- | :--- | :--- |
| `[Internal.name]` | 同目錄/同Feature | **LOW** | 這是最理想的依賴 |
| `[Shared.name]` | `src/shared/` | **LOW** | 全域共用工具 |
| `[Config.name]` | `src/config/` | **LOW** | 靜態配置 |
| `[Lib.name]` | `src/lib/` | **LOW** | 第三方庫封裝 |
| `[Database.tbl_name]` | 資料庫表 | **MEDIUM** | 精確到表名 |
| **`[Module.Name]`** | **不同模組** | **HIGH** | **需重構**：應盡量減少 |

**範例**：
```typescript
// ✅ 推薦格式（有說明）
GEMS-DEPS: [Database.tbl_users (查詢)], [Module.Auth (驗證)], [Shared.formatDate (格式化)]

// ✅ 也可接受（無說明）
GEMS-DEPS: [Database.tbl_users], [Module.Auth]

// ❌ 不接受（太籠統）
GEMS-DEPS: [Database], [Supabase]
```

#### 🎯 DEPS 精確化規則：Vague Dependency Trap

**問題**：`[Supabase]` 這種標籤等於沒寫，無法追蹤重構影響

```typescript
// ❌ 錯誤 - 太籠統
GEMS-DEPS: [Supabase]

// 內部實際使用了 tbl_roster_students 和 tbl_meal_log
// 當重構 tbl_meal_log 時，搜尋不到這個函式
```

**解法**：必須精確到「表 (Table)」或「模組 (Module)」

```typescript
// ✅ 正確 - 精確到表（v2.1 折衷格式）
GEMS-DEPS: [Database.tbl_roster_students (查詢學員)], [Database.tbl_meal_log (查詢用餐記錄)]
```

#### 🚫 DEPS 排除清單：Type Noise Trap

**問題**：純型別 (interface/type) 是編譯時期產物，不會造成 Runtime 耦合

```typescript
// ❌ 錯誤 - 型別是雜訊
GEMS-DEPS: [types.MealStatistics]

// 這會讓真正重要的依賴（如 API、Helper functions）被淹沒
```

**解法**：只列 Runtime 依賴

```typescript
// ✅ 正確 - Pure Function 無 Runtime 依賴
GEMS-DEPS: []

// ✅ 例外 - Zod Schema 有 Runtime 代碼
GEMS-DEPS: [schema.MealStatisticsSchema] (Zod 驗證)

// ✅ 例外 - Class 有 Runtime 代碼
GEMS-DEPS: [class.ValidationError] (自定義錯誤類)
```

**DEPS 排除清單（不應列入）：**
| 類型 | 原因 | 例外 |
|------|------|------|
| `interface` | 編譯後消失 | - |
| `type` | 編譯後消失 | - |
| `enum` (const) | 編譯後消失 | 非 const enum |
| 泛型參數 | 編譯後消失 | - |

**DEPS 應列入清單：**
| 類型 | 原因 |
|------|------|
| Zod Schema | 有 Runtime 驗證代碼 |
| Class | 有 Runtime 實例化 |
| 函式 | 有 Runtime 執行 |
| 常數物件 | 有 Runtime 值 |

### 3.3 GEMS-ALGO (已廢棄 - v2.1)

> ⚠️ **DEPRECATED**: `GEMS-ALGO` 已在 v2.1 移除，由以下方式取代：
> 1. **流程概覽**：使用 `GEMS-FLOW` + `[STEP]` 錨點
> 2. **邏輯細節**：移至 Requirement Spec 的 **Scenario Table**

#### 為什麼移除？

**問題**：ALGO 容易過時，變成「謊言」

```typescript
// ❌ v2.0 - ALGO 寫太具體
GEMS-ALGO: 1.乘以 0.05 計算稅率 2.加上 $50 服務費

// 當稅率改成 0.08 時，這段註解就變成謊言
```

**解法**：由 Requirement Spec 的 **Scenario Table** 承載邏輯細節

#### 替代方案

| 需求 | v2.0 做法 | v2.1 做法 |
|------|----------|----------|
| 了解邏輯流程 | 看 `GEMS-FLOW` | 看 `GEMS-FLOW` + `[STEP]` 錨點 |
| 了解演算法細節 | 看 `GEMS-ALGO` | 看 Requirement Spec 的 Scenario Table |
| 驗證實作正確性 | 手動對照 | Scanner 自動驗證 `[STEP]` 對應 |

#### 遷移指南

**舊代碼**（v2.0）：
```typescript
/**
 * GEMS-FLOW: ResolveRule→CalculateCost→Return
 * GEMS-ALGO: 1.解析計價規則 2.統計餐次 3.套用計價邏輯 4.計算總費用
 */
```

**新代碼**（v2.1）：
```typescript
/**
 * GEMS-FLOW: ResolveRule→CalculateCost→Return
 */
// [STEP] ResolveRule
// 解析計價規則層級 (Class -> Student)
// [STEP] CalculateCost
// 根據 Rule.mode 執行對應算法
// [STEP] Return
```

**邏輯細節**：移至 `requirement_spec_Story-X.X.md` 的 Scenario Table。

### 3.4 [STEP] 錨點規則 (v2.1 新增)

**用途**：確保 `GEMS-FLOW` 與實際代碼 100% 對應，讓 Scanner 可驗證「說到做到」。

#### 強制範圍

| 優先級 | [STEP] 錨點 | 說明 |
|--------|-------------|------|
| **P0** | ✅ 強制 | 核心邏輯必須有錨點，確保可追蹤 |
| **P1** | ✅ 強制 | 重要功能必須有錨點 |
| **P2** | ⭕ 可選 | 輔助功能，建議有但不強制 |
| **P3** | ⭕ 可選 | 簡單功能，通常不需要（單元無依賴） |

#### 錨點驗證

Scanner 會檢查：
- Header 的 `GEMS-FLOW` 步驟數 = 代碼中的 `[STEP]` 數量
- 步驟名稱必須完全一致（大小寫敏感）

**範例**：
```typescript
// ✅ 正確 - 3 個 FLOW 步驟 = 3 個 [STEP] 錨點
/**
 * GEMS: validateInput | P0 | ✓✓ | (data)→Result | Story-1.0
 * GEMS-FLOW: CheckRequired→ValidateRanges→Return
 */
export function validateInput(data: Input): Result {
  // [STEP] CheckRequired
  if (!data.name) throw new Error('Name required');
  
  // [STEP] ValidateRanges
  if (data.age < 0 || data.age > 120) throw new Error('Invalid age');
  
  // [STEP] Return
  return { valid: true };
}
```

```typescript
// ❌ 錯誤 - FLOW 有 3 步，但只有 2 個 [STEP]
/**
 * GEMS-FLOW: Validate→Process→Return
 */
// [STEP] Validate
// [STEP] Process
// 缺少 [STEP] Return ← Scanner 會報錯
```

#### P2/P3 可選範例

```typescript
// ✅ P2 可選 - 簡單邏輯可不加 [STEP]
/**
 * GEMS: formatDate | P2 | ✓✓ | (date)→string | Story-1.0
 * GEMS-FLOW: Parse→Format→Return
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

---

### 3.5 GEMS-STATE (狀態管理 - React 專用)

描述元件使用了哪些狀態。

```typescript
GEMS-STATE: local: { page, filter }, global: { UserSession }, server: { attendanceList }
```

### 3.6 GEMS-SIDE-EFFECT (副作用 - Hooks 專用)

描述是否呼叫 API、修改 DOM 或訂閱事件。

```typescript
GEMS-SIDE-EFFECT: API Call (useEffect), Window Resize Listener
```

-----

## 4. 完整範例

### 範例 1: React Component (P1)

```typescript
/**
 * GEMS: StudentAttendanceList | P1 | ✓✓ | ({classId})→UI | Story-15.2 | 學生出勤列表元件
 * GEMS-FLOW: CheckLoading→RenderHeader→RenderList→RenderPagination
 * GEMS-DEPS: [Internal.useAttendanceData (Hook)], [Shared.DataTable (元件)], [Shared.formatDate (工具)]
 * GEMS-STATE: local: { pageIndex }, server: { students }
 * GEMS-TEST: jest-unit
 * GEMS-TEST-FILE: StudentAttendanceList.test.tsx
 */
export const StudentAttendanceList = ({ classId }: Props) => {
  // [STEP] CheckLoading
  if (isLoading) return <Spinner />;
  
  return (
    <>
      {/* [STEP] RenderHeader */}
      <Header title="出勤列表" />
      
      {/* [STEP] RenderList */}
      <DataTable data={students} />
      
      {/* [STEP] RenderPagination */}
      <Pagination page={pageIndex} />
    </>
  );
}
```

### 範例 2: Custom Hook (P0 - 核心邏輯)

```typescript
/**
 * GEMS: useMenuCalculation | P0 | ✓✓ | (menuId)→{cost, nutrients} | Story-14.3 | 菜單計算邏輯封裝
 * GEMS-FLOW: FetchMenu→CalculateCost→CalculateNutrients→ReturnData
 * GEMS-DEPS: [Internal.fetchMenuApi (API)], [Internal.nutrientService (邏輯)], [Module.DailyMenu (跨模組)]
 * GEMS-DEPS-RISK: MEDIUM (依賴了 daily-menu 模組)
 * GEMS-SIDE-EFFECT: API Call (useEffect)
 * GEMS-TEST: jest-integ
 * GEMS-TEST-FILE: useMenuCalculation.integration.test.ts
 */
export const useMenuCalculation = (menuId: string) => {
  // [STEP] FetchMenu
  useEffect(() => {
    fetchMenuApi(menuId).then(setMenu);
  }, [menuId]);
  
  // [STEP] CalculateCost
  const cost = useMemo(() => calculateCost(menu), [menu]);
  
  // [STEP] CalculateNutrients
  const nutrients = useMemo(() => calculateNutrients(menu), [menu]);
  
  // [STEP] ReturnData
  return { cost, nutrients };
}
```

### 範例 3: 資料庫查詢服務 (精確 DEPS)

```typescript
/**
 * GEMS: loadClassMealData | P1 | ✓✓ | (classId, weekId)→Promise<MealData[]> | Story-16.1 | 載入班級用餐資料
 * GEMS-FLOW: ValidateInput→QueryDatabase→MapToDomain→Return
 * GEMS-DEPS: [Database.tbl_roster_students (查詢學員)], [Database.tbl_meal_log (查詢記錄)], [Lib.supabaseClient (連線)], [Internal.toMealDataDomain (轉換)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: jest-unit
 * GEMS-TEST-FILE: previewService.test.ts
 */
export async function loadClassMealData(classId: number, weekId: string) {
  // [STEP] ValidateInput
  if (!classId || !weekId) throw new Error('Invalid input');
  
  // [STEP] QueryDatabase
  const students = await db.from('tbl_roster_students').select('*').eq('class_id', classId);
  const meals = await db.from('tbl_meal_log').select('*').eq('week_id', weekId);
  
  // [STEP] MapToDomain
  const data = toMealDataDomain(students, meals);
  
  // [STEP] Return
  return data;
}
```

### 範例 4: Pure Function (無 Runtime 依賴)

```typescript
/**
 * GEMS: validateMealStatistics | P2 | ✓✓ | (stats)→ValidationResult | Story-14.5 | 驗證餐費統計資料
 * GEMS-FLOW: CheckRequired→ValidateRanges→Return
 * GEMS-DEPS: []
 * GEMS-TEST: jest-unit
 * GEMS-TEST-FILE: billingService.test.ts
 * 
 * 注意：雖然使用了 MealStatistics 型別，但純型別不列入 DEPS
 */
export function validateMealStatistics(stats: MealStatistics): ValidationResult { ... }
```

### 範例 5: 複雜 Service Function (P0 - 需重構)

```typescript
/**
 * GEMS: syncAllModulesData | P0 | ✓⚠ | (weekId)→Promise<Result> | Story-20.1 | 同步所有模組
 * GEMS-FLOW: SyncClasses→SyncMeals→SyncReports
 * GEMS-DEPS: [Module.ClassManagement (同步班級)], [Module.Pricing (計算)], [Lib.supabaseClient (連線)]
 * GEMS-DEPS-RISK: HIGH (依賴多個外部模組)
 * GEMS-DEPS-OPTIMIZATION: 建議建立 SyncOrchestrator 在 shared 層統一管理
 * GEMS-TEST: jest-integ
 */
export async function syncAllModulesData(weekId: string) {
  // [STEP] SyncClasses
  await classService.sync(weekId);
  
  // [STEP] SyncMeals
  await mealService.sync(weekId);
  
  // [STEP] SyncReports
  await reportService.sync(weekId);
  
  return { success: true };
}
```

-----

## 5. 測試策略決策樹 (v4.0 — 機械推導)

> **核心原則**：測試策略在 `draft-to-plan` 階段由 GEMS-FLOW + GEMS-DEPS 機械推導，寫入骨架。Phase 3 只執行策略，沒有自由裁量空間。

### 5.1 GEMS-TEST 新格式

```typescript
GEMS-TEST: ac-runner          // 純計算 + 有 AC 驗收條件（最強）
GEMS-TEST: jest-unit          // 純計算，無 AC
GEMS-TEST: jest-integ         // 跨邊界格式轉換
GEMS-TEST: poc-html           // 外部資源（GAS/fetch/DOM）
GEMS-TEST: skip               // 無測試需求
```

`GEMS-TEST-FILE` 只有 `jest-unit` / `jest-integ` 需要填，其他策略填 `-`。

### 5.2 推導規則（優先順序由高到低）

| 條件 | 訊號來源 | 策略 |
|------|---------|------|
| C: 外部資源（優先） | GEMS-FLOW 含 `GAS/SHEET/SPREADSHEET/FETCH/DOM` 或 DEPS 含外部資源 | `poc-html` |
| A: 非顯然計算 | GEMS-FLOW 含 `CALC/COMPUTE/PARSE/FORMAT/CONVERT/ROC/DATE/FILTER/SORT` | `ac-runner`（有AC）或 `jest-unit` |
| B: 跨邊界格式 | 有 deps 且 `GEMS-DEPS-RISK: MEDIUM` 或 `HIGH` | `jest-integ` |
| 無 A/B/C | — | `skip` |

### 5.3 各策略說明

#### ac-runner（最強驗收）
- 適用：GEMS-FLOW 含計算步驟 + 函式有 AC 驗收條件
- 機制：`ac-runner.cjs` 讀取 contract.ts 的 AC 測試案例，純計算驗收
- 優點：spec 由人鎖定，AI 不能改，是最可靠的驗收機制

#### jest-unit
- 適用：GEMS-FLOW 含計算步驟，但沒有 AC
- 機制：標準 Jest 單元測試，mock 所有外部依賴
- 檔案命名：`*.test.ts`

#### jest-integ
- 適用：函式有跨邊界 deps 且 DEPS-RISK MEDIUM+
- 機制：真實 import 依賴模組，只 mock 外部 API/DB
- 禁止：`jest.mock()` 核心邏輯
- 必須：有效 assertion（`toBe`, `toEqual`, `toHaveBeenCalledWith` 等）
- 檔案命名：`*.integration.test.ts`

#### poc-html
- 適用：函式依賴 GAS/Spreadsheet/fetch/DOM 等外部資源
- 機制：在 POC HTML 中手動驗證，不寫 Jest
- 原因：這類函式的「測試」本質上是環境整合，Jest mock 沒有意義

#### skip
- 適用：純型別宣告、簡單 UI 渲染、無 A/B/C 條件
- 機制：不寫測試，Phase 4 不要求測試檔案存在

### 5.4 決策樹範例

```typescript
// 範例 1: GAS 呼叫 → poc-html
// GEMS-FLOW: READ_SHEET→PARSE→RETURN
// GEMS-DEPS: [GAS.SpreadsheetApp]
// GEMS-TEST: poc-html

// 範例 2: 純計算 + AC → ac-runner
// GEMS-FLOW: PARSE→CALC→RETURN
// GEMS-DEPS: 無
// AC-1.0
// GEMS-TEST: ac-runner

// 範例 3: 跨模組 + MEDIUM risk → jest-integ
// GEMS-FLOW: LOAD→TRANSFORM→SAVE
// GEMS-DEPS: [Module.Dashboard], [Module.GasApi]
// GEMS-DEPS-RISK: MEDIUM
// GEMS-TEST: jest-integ
// GEMS-TEST-FILE: load-training-data.integration.test.ts

// 範例 4: 純型別 → skip
// GEMS-FLOW: DEFINE
// GEMS-DEPS: 無
// GEMS-TEST: skip
```

-----

## 6. 品質檢查清單 (Quality Checklist) [v2.1 更新]

### 🔍 DEPS 檢查

- [ ] **精確化**: 沒有 `[Supabase]`、`[Database]` 這種籠統標籤
- [ ] **去雜訊**: 沒有純 `interface`/`type` 依賴
- [ ] **表名明確**: 資料庫依賴使用 `[Database.tbl_name]` 格式
- [ ] **折衷格式**: 使用 `[Type.Name (說明)]` 或 `[Type.Name]`

### 🔍 FLOW 檢查

- [ ] **顆粒度**: 3-5 個步驟，不超過 7 個
- [ ] **顯性化**: 超過 3 行的 mapping 有 `Map/Transform` 步驟
- [ ] **分離**: React 元件的 Render 和 Handler 分開標記

### 🔍 [STEP] 錨點檢查 (v2.1 新增)

- [ ] **P0/P1 強制**: 核心與重要功能必須有 `[STEP]` 錨點
- [ ] **數量對應**: `GEMS-FLOW` 步驟數 = `[STEP]` 數量
- [ ] **名稱一致**: 步驟名稱完全一致（大小寫敏感）
- [ ] **P2/P3 彈性**: 簡單功能可選擇性使用

### 🔍 ALGO 檢查 (已廢棄)

- [ ] **v2.1**: 不再使用 `GEMS-ALGO`，改用 Requirement Spec 的 Scenario Table

-----

## 7. AI 協作指令 (AI Prompts)

在您的 IDE AI 助手 (如 Cursor, VSCode Copilot, Windsurf 等) 中，您可以使用以下指令來利用這些標籤：

1.  **架構健康檢查**:

    > "Scan all files in `src/modules/meal-management`. List any functions marked with `GEMS-DEPS-RISK: HIGH` or that have `[cross-module]` dependencies."

2.  **生成測試代碼**:

    > "Read the `GEMS-FLOW` and `GEMS-TEST-FILE` path for `calculateMealCost`. Create the missing Integration Test based on the flow description."

3.  **理解功能全貌**:

    > "Summarize the logic of `StudentAttendanceList` based on its GEMS tags, specifically the FLOW and STATE sections."

4.  **尋找可重構點**:

    > "Find all P0 functions that are marked as `GEMS-DEPS-RISK: MEDIUM` or `HIGH` and suggest refactoring strategies."

5.  **檢查 DEPS 品質**:

    > "Find all functions with `[Supabase]` or `[Database]` in GEMS-DEPS that don't specify table names. These need to be made more specific."

6.  **檢查 Type Noise**:

    > "Find all GEMS-DEPS that reference `types.` or `interface.` - these should be removed as they are compile-time only."

-----

## 8. VSCode Snippets (v2.1 更新版)

將此加入 `.vscode/typescript.code-snippets` 以快速生成 React 標籤：

```json
{
  "GEMS-Component-P1": {
    "prefix": "gems-comp",
    "body": [
      "/**",
      " * GEMS: ${1:ComponentName} | P1 | ✓✓ | (props)→UI | ${2:Story-X.X} | ${3:描述}",
      " * GEMS-FLOW: ${4:CheckLoading→RenderContent}",
      " * GEMS-DEPS: [Internal.${5:hook} (${6:說明})], [Shared.${7:component} (${8:說明})]",
      " * GEMS-STATE: local: {${9}}, server: {${10}}",
      " * GEMS-TEST: jest-unit",
      " * GEMS-TEST-FILE: ${1:ComponentName}.test.tsx",
      " */",
      "export const ${1:ComponentName} = ({ ${11:props} }: Props) => {",
      "  // [STEP] ${4:CheckLoading}",
      "  $0",
      "}"
    ]
  },
  "GEMS-Hook-P0": {
    "prefix": "gems-hook",
    "body": [
      "/**",
      " * GEMS: ${1:useHookName} | P0 | ✓✓ | (${2:args})→{${3:output}} | ${4:Story-X.X} | ${5:描述}",
      " * GEMS-FLOW: ${6:Step1→Step2→Step3}",
      " * GEMS-DEPS: [Internal.${7:apiFunc} (${8:說明})]",
      " * GEMS-DEPS-RISK: MEDIUM",
      " * GEMS-SIDE-EFFECT: ${9:API Call}",
      " * GEMS-TEST: jest-integ",
      " * GEMS-TEST-FILE: ${1:useHookName}.integration.test.ts",
      " */",
      "export const ${1:useHookName} = (${2:args}) => {",
      "  // [STEP] ${6:Step1}",
      "  $0",
      "}"
    ]
  },
  "GEMS-Service-P1": {
    "prefix": "gems-svc",
    "body": [
      "/**",
      " * GEMS: ${1:functionName} | P1 | ✓✓ | (${2:args})→Promise<${3:Result}> | ${4:Story-X.X} | ${5:描述}",
      " * GEMS-FLOW: ${6:ValidateInput→QueryDatabase→MapToDomain→Return}",
      " * GEMS-DEPS: [Database.${7:tbl_name} (${8:說明})], [Lib.supabaseClient (連線)]",
      " * GEMS-DEPS-RISK: ${9:LOW}",
      " * GEMS-TEST: jest-unit",
      " * GEMS-TEST-FILE: ${10:fileName}.test.ts",
      " */",
      "export async function ${1:functionName}(${2:args}): Promise<${3:Result}> {",
      "  // [STEP] ${6:ValidateInput}",
      "  $0",
      "}"
    ]
  },
  "GEMS-PureFunction-P2": {
    "prefix": "gems-pure",
    "body": [
      "/**",
      " * GEMS: ${1:functionName} | P2 | ✓✓ | (${2:args})→${3:Result} | ${4:Story-X.X} | ${5:描述}",
      " * GEMS-FLOW: ${6:Validate→Transform→Return}",
      " * GEMS-DEPS: []",
      " * GEMS-TEST: skip",
      " */",
      "export function ${1:functionName}(${2:args}): ${3:Result} {",
      "  $0",
      "}"
    ]
  },
  "GEMS-STEP-Anchor": {
    "prefix": "gems-step",
    "body": [
      "// [STEP] ${1:StepName}",
      "$0"
    ],
    "description": "v2.1: 插入 STEP 錨點"
  }
}
```

-----

## 9. 常見錯誤與修正 (Anti-Patterns) [v2.1 更新]

### ❌ Anti-Pattern 1: Vague Dependency
```typescript
// 錯誤
GEMS-DEPS: [Supabase]

// 修正 (v2.1 折衷格式)
GEMS-DEPS: [Database.tbl_roster_students (查詢學員)], [Database.tbl_meal_log (查詢記錄)]
```

### ❌ Anti-Pattern 2: Type Noise
```typescript
// 錯誤
GEMS-DEPS: [types.MealStatistics], [types.PricingRule]

// 修正
GEMS-DEPS: []  // Pure function，無 Runtime 依賴
```

### ❌ Anti-Pattern 3: Hidden Mapper
```typescript
// 錯誤
GEMS-FLOW: Query→Return

// 修正
GEMS-FLOW: Query→MapToDomain→Return
// [STEP] Query
// [STEP] MapToDomain
// [STEP] Return
```

### ❌ Anti-Pattern 4: Using ALGO (v2.1 已廢棄)
```typescript
// 錯誤 (v2.0)
GEMS-ALGO: 1.乘以 0.05 2.加上 50 3.用 Math.round

// 修正 (v2.1) - 移除 ALGO，使用 [STEP] 錨點
GEMS-FLOW: ApplyTax→AddFee→FormatAmount
// [STEP] ApplyTax
// [STEP] AddFee
// [STEP] FormatAmount
```

### ❌ Anti-Pattern 5: Mixed Flow (React)
```typescript
// 錯誤
GEMS-FLOW: RenderForm→OnSubmit→Validate→CallAPI→Redirect

// 修正 - 分離
// Component: GEMS-FLOW: InitHooks→CheckAuth→RenderForm
// Handler:   GEMS-FLOW: Validate→CallAPI→Redirect
```

### ❌ Anti-Pattern 6: Missing [STEP] Anchors (v2.1 新增)
```typescript
// 錯誤 (P0/P1 沒有錨點)
/**
 * GEMS: processOrder | P0 | ✓✓ | (order)→Result | Story-1.0
 * GEMS-FLOW: Validate→Process→Save
 */
export function processOrder(order) {
  // 沒有 [STEP] 錨點
}

// 修正
/**
 * GEMS: processOrder | P0 | ✓✓ | (order)→Result | Story-1.0
 * GEMS-FLOW: Validate→Process→Save
 */
export function processOrder(order) {
  // [STEP] Validate
  if (!order.id) throw new Error('Invalid');
  
  // [STEP] Process
  const result = calculate(order);
  
  // [STEP] Save
  return db.save(result);
}
```

-----

## 10. UI 與佈局標籤 (GEMS-UI & LAYOUT)

> 💡 這類標籤專門解決 `<div>` 海與 CSS 雜訊過多的問題，目的是讓架構師 **3 秒內** 看穿畫面結構。

### 10.1 適用範圍

| 標籤類型 | 適用檔案 | 必要性 |
|----------|----------|--------|
| `GEMS-*` (核心) | `.ts`, `.tsx`, `.js` | ✅ 必備 |
| `GEMS-UI` (視覺) | `.tsx`, `.html`, `.vue` | 📋 建議 |
| `GEMS-LAYOUT/ZONE/ATOM` | 複雜 UI 元件 | ⭕ 可選 |

### 10.2 GEMS-UI (統一 UI 標籤)

**用途**：一行描述 UI 元件的佈局結構與功能區域。

**格式**：
```typescript
// GEMS-UI: {ContainerName} ({LayoutType}) | Zones: [{Zone1}, {Zone2}, ...]
```

**範例**：
```typescript
/**
 * GEMS: MealCard | P1 | ✓✓ | (props)→UI | Story-14.3 | 餐點卡片
 * GEMS-FLOW: CheckLoading→RenderCard
 * GEMS-UI: CardContainer (Flex-Col) | Zones: [Header, Body, Action]
 */
export const MealCard = ({ meal }: Props) => { ... }
```

### 10.3 GEMS-LAYOUT (空間佈局)

**用途**：描述容器的「排列方式」，翻譯 CSS 的 Flex/Grid 邏輯。

| 關鍵字 | 意義 | 數學概念 |
|--------|------|----------|
| `Flex-Col` | 垂直排列 | y 軸堆疊 (Stack) |
| `Flex-Row` | 水平排列 | x 軸序列 (Sequence) |
| `Grid-N` | N 欄網格 | N 列矩陣 (Matrix) |
| `Overlay` | 懸浮覆蓋 | z 軸層級 (Layer) |

**範例**：
```typescript
// GEMS-LAYOUT: DashboardGrid (Grid-3 | Sidebar + Main + Widget)
<div className="grid grid-cols-12 gap-4">
  ...
</div>
```

### 10.4 GEMS-ZONE (功能區域)

**用途**：為 HTML 區塊命名，定義「這是什麼區域」。

**格式**：
```typescript
// GEMS-ZONE: [{ZoneName}] ({功能說明})
```

**範例**：
```typescript
// GEMS-ZONE: [Sidebar] (Navigation Menu)
<aside className="...">...</aside>

// GEMS-ZONE: [MainContent] (Meal List Table)
<main className="...">...</main>

// GEMS-ZONE: [ActionBar] (CRUD Buttons)
<footer className="...">...</footer>
```

### 10.5 GEMS-ATOM (原子樣式封裝)

**用途**：當 Tailwind CSS 超過 5 個 class 難以閱讀時，用此標籤說明「視覺意圖」。

**格式**：
```typescript
// GEMS-ATOM: [Visual: {意圖}] ({主要樣式關鍵字})
```

**範例**：
```typescript
// GEMS-ATOM: [Visual: Primary Button] (Blue-500, Rounded, Shadow)
<button className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded shadow-lg">
  送出
</button>

// GEMS-ATOM: [Visual: Status Badge] (Success-Green, Pill Shape)
<span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
  供應中
</span>
```

### 10.6 完整範例：改造前 vs 改造後

#### ❌ 改造前 (只有代碼，像天書)
```typescript
return (
  <div className="flex flex-col p-4 border rounded shadow-md bg-white">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-bold">午餐 A 餐</h2>
      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">供應中</span>
    </div>
    <div className="space-y-2 text-gray-600">
      <p>主食：排骨</p>
      <p>熱量：800 kcal</p>
    </div>
    <button className="mt-4 w-full bg-blue-600 text-white py-2 rounded">訂購</button>
  </div>
);
```
*(架構師 os: 這是一堆什麼符號？)*

#### ✅ 改造後 (加上 GEMS 標籤)
```typescript
/**
 * GEMS: MealCard | P2 | ✓✓ | ({meal})→UI | Story-15.1 | 餐點展示卡片
 * GEMS-UI: CardContainer (Flex-Col) | Zones: [Header, Body, Action]
 */
return (
  // GEMS-LAYOUT: CardContainer (Flex-Col | Vertical Stack)
  <div className="flex flex-col p-4 border rounded shadow-md bg-white">

    {/* GEMS-ZONE: [Header] (Title + Status Badge) */}
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-bold">午餐 A 餐</h2>
      {/* GEMS-ATOM: [Visual: Status Badge] (Success-Green) */}
      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">供應中</span>
    </div>

    {/* GEMS-ZONE: [Body] (Info List) */}
    <div className="space-y-2 text-gray-600">
      <p>主食：排骨</p>
      <p>熱量：800 kcal</p>
    </div>

    {/* GEMS-ZONE: [Action] (Full Width Button) */}
    {/* GEMS-ATOM: [Visual: Primary Button] (Blue-600, Full Width) */}
    <button className="mt-4 w-full bg-blue-600 text-white py-2 rounded">訂購</button>
  </div>
);
```
*(架構師 os: 喔！這是一個「垂直堆疊」的卡片，分「頭、身、腳」三塊。懂了。)*

-----

## 11. POC 階段標籤策略 (Pre-Tagging Strategy)

> 💡 POC 階段的標籤不是為了「解釋程式碼邏輯」，而是為了 **「向後端與未來的自己下訂單」**。

### 11.1 POC 三大核心標籤

| 標籤 | 位置 | 作用 | AI 讀取意義 |
|------|------|------|-------------|
| `@GEMS-STORY` | 檔案最上方 | 關聯需求 | 「驗收 Story-X.X 時看此檔案」 |
| `@GEMS-CONTRACT` | Mock Data interface 上 | 前後端契約 | 「後端 API 必須返回此結構」|
| `@GEMS-UI` | 主要 Component 上 | 定義 UI 區塊 | 「這是主視圖」 |

### 11.2 POC 黃金標準 (三不一要)

| 規則 | 說明 |
|------|------|
| ❌ **不要**寫業務運算邏輯 | 稅率、庫存加減由後端處理 |
| ❌ **不要**寫真實 Fetch | 不寫 `fetch('/api/...')` 或 async |
| ❌ **不要**過度細節 | 一個元件不超過 100 行 |
| ✅ **要**寫 UI 狀態邏輯 | 點擊編輯 → 輸入框解鎖 |
| ✅ **要**定義資料形狀 | interface + MOCK_DATA |

### 11.3 POC 完整範例

```typescript
// @GEMS-STORY: Story-2.0 (庫存盤點與查詢)
// @GEMS-DESC: 這是盤點人員使用的主要畫面，包含列表與編輯模式。
// @GEMS-AUTHOR: Architect (POC Phase)

import React, { useState } from 'react';

// ---------------------------------------------------------
// @GEMS-CONTRACT: InventoryItem
// 注意：這是前後端交握的唯一真理。後端 API 必須返回此結構。
// ---------------------------------------------------------
interface InventoryItem {
  id: string;        // UUID
  sku: string;       // 料號
  name: string;      // 品名
  currentQty: number;// 帳面數量
  checkedQty: number | null; // 盤點數量 (null 代表未盤)
}

// @GEMS-MOCK: 模擬資料，用於驗證 UI 狀態
const MOCK_DATA: InventoryItem[] = [
  { id: '1', sku: 'A-001', name: 'MacBook Pro', currentQty: 10, checkedQty: null },
  { id: '2', sku: 'A-002', name: 'Keychron K2', currentQty: 5, checkedQty: 5 },
];

// ---------------------------------------------------------
// @GEMS-UI: InventoryScreen
// GEMS-UI: PageContainer (Flex-Col) | Zones: [Header, List, Footer]
// ---------------------------------------------------------
export default function InventoryPOC() {
  const [items, setItems] = useState(MOCK_DATA);
  const [isEditMode, setEditMode] = useState(false);

  // @GEMS-FLOW: 切換盤點模式 (UI-Only Logic)
  const toggleMode = () => setEditMode(!isEditMode);

  return (
    // GEMS-LAYOUT: PageContainer (Flex-Col)
    <div className="p-4">
      {/* GEMS-ZONE: [Header] (Mode Toggle) */}
      <button onClick={toggleMode}>
        {isEditMode ? '取消' : '盤點模式'}
      </button>
      
      {/* GEMS-ZONE: [List] (Inventory Table) */}
      {items.map(item => (
        <div className={isEditMode ? 'bg-yellow-100' : 'bg-white'}>
          {item.name} - {item.currentQty}
        </div>
      ))}
    </div>
  );
}
```

### 11.4 POC 標籤在雙向閉環中的作用

1. **切換到後端實作時**：
   > 「請掃描 `InventoryPOC.tsx` 中的 `@GEMS-CONTRACT`，基於該結構設計 Prisma Schema 和 REST API。」
   
   👉 後端一次做對，欄位名稱完全一致。

2. **執行 gems:scan 時**：
   > 掃描器讀取 `@GEMS-STORY` 和 `@GEMS-DESC`
   
   👉 規格書自動顯示：「Story-2.0 已有 UI 原型，資料結構為 `InventoryItem`。」

3. **切換到前端實作時**：
   > 「保留 `@GEMS-UI` 和 `@GEMS-STORY`，將 `@GEMS-MOCK` 替換為真實 API 串接。」
   
   👉 平滑過渡，標籤從「定義」轉變為「實作」。

-----

## 12. UI 標籤品質檢查清單

### 🔍 GEMS-UI 檢查

- [ ] **統一性**: 複雜元件使用 `GEMS-UI` 一行描述結構
- [ ] **Zone 命名**: 區域名稱語義化 (Header/Body/Footer/Action)
- [ ] **簡潔性**: 不超過 3-5 個 Zones

### 🔍 GEMS-LAYOUT 檢查

- [ ] **必要性**: 只有容器元素才需要 LAYOUT 標籤
- [ ] **精確性**: 使用正確的佈局關鍵字 (Flex-Col/Grid-N)

### 🔍 GEMS-ATOM 檢查

- [ ] **閾值**: 只有超過 5 個 Tailwind class 才使用
- [ ] **意圖**: 描述「視覺意圖」而非「樣式細節」

### 🔍 POC 檢查

- [ ] **CONTRACT**: Mock Data interface 已標記 `@GEMS-CONTRACT`
- [ ] **STORY**: 檔案頂部有 `@GEMS-STORY` 關聯需求
- [ ] **三不一要**: 無業務邏輯、無 API 調用、有 UI 狀態

