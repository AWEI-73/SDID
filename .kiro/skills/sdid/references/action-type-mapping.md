# 動作類型 → 模組目錄映射

## 映射表

| 類型 | 對應目錄 | 說明 | 典型場景 |
|------|---------|------|---------|
| CONST | constants.ts | 常數/配置 | 環境變數、型別定義、表單規則、預設值 |
| LIB | lib/ 或 api/ | 第三方庫封裝 | HTTP Client、儲存層、日期工具、i18n |
| API | api/ | 純 HTTP 請求 (DTO 接收) | Fetch/Axios 呼叫、Endpoint 定義 |
| SVC | services/ | 純業務邏輯/資料轉換 | DTO→Model 轉換、計算邏輯、資料清洗 |
| HOOK | hooks/ | 互動邏輯 (React Hook) | 狀態管理、API 呼叫封裝、表單邏輯 |
| UI | components/ | 介面元件 | 表單、表格、圖表、卡片、對話框 |
| ROUTE | pages/ | 路由頁面入口 | 動態路由、頁面佈局、守衛 |
| SCRIPT | scripts/ | 部署/建置腳本 | CI/CD、資料遷移、Seed |

## 優先級定義

| 優先級 | 定義 | 範例 |
|--------|------|------|
| P0 | 端到端協議 (API/DB/第三方串接) | createRecord, dbClient, CoreTypes |
| P1 | 整合依賴 (跨模組呼叫) | useDataEntry, factorService |
| P2 | 獨立功能 (純邏輯/獨立 UI) | ENV_CONFIG, formatDate |
| P3 | 輔助功能 (日誌/格式化/工具) | logger, debugPanel |

## 流向描述格式

用 `→` 連接步驟，描述資料流動方向：

```
VALIDATE → CALC_CO2E → PERSIST          (API 動作)
RECV_DTO → MAP_MODEL → EXPORT           (SVC 動作)
CALL_API → UPDATE_STATE → RENDER        (HOOK 動作)
LOAD_DATA → RENDER → BIND_EVENTS        (UI 動作)
DEFINE → FREEZE → EXPORT                (CONST 動作)
CONNECT → POOL → EXPORT                 (LIB 動作)
```

## 前端類型 FLOW 詞彙

UI / HOOK / ROUTE 類型的 FLOW 應描述**業務行為**，不是 React 框架機制。

| 類型 | 正確詞彙 | 錯誤詞彙 | 說明 |
|------|---------|---------|------|
| UI | `FETCH_DATA`, `RENDER`, `BIND_EVENTS`, `BIND_DOWNLOAD`, `FILTER`, `SORT` | `MOUNT`, `CONFIG`, `USEEFFECT` | 描述使用者看到什麼、能做什麼 |
| HOOK | `CALL_API`, `UPDATE_STATE`, `VALIDATE`, `DEBOUNCE`, `RETURN` | `USESTATE`, `USEEFFECT` | 描述資料流動，不是 React API |
| ROUTE | `CHECK_AUTH`, `LOAD_DATA`, `RENDER_LAYOUT`, `RENDER_CONTENT` | `MOUNT`, `RENDER` (太泛) | 描述頁面進入後的業務流程 |

**原則**：FLOW 詞彙要讓人讀了就知道「這個 component 做什麼業務」，不是「React 怎麼執行它」。

**樣式提示**：UI / ROUTE 類型的元件需要搭配樣式檔。藍圖的「共用模組」區塊會宣告專案級別的「樣式策略」（CSS Modules / Tailwind / Global CSS / CSS-in-JS），plan-to-scaffold 會根據該欄位自動生成對應的 CSS 骨架。

範例：
```
✅ FETCH_LIST → BIND_EVENTS → RENDER_TABLE     (題庫列表，使用者能搜尋/排序)
✅ CHECK_AUTH → LOAD_DATA → RENDER_DASHBOARD   (統計頁，需登入才能看)
✅ CALL_SVC → UPDATE_STATE → RENDER            (Hook，封裝 API 呼叫)
❌ CONFIG → MOUNT → RENDER                     (沒有業務語意)
❌ USESTATE → USEEFFECT → RETURN               (React 內部機制)
```

## 填充等級

| 等級 | 說明 | 適用場景 |
|------|------|---------|
| Full | 所有動作都列出 | 準備開發的模組 (近期迭代) |
| Partial | 部分動作列出 | 確定資料結構但功能待定 |
| Stub | 只有描述 | 遠期模組、初期探索 |

Stub 格式：
```markdown
### Iter 4: report-gen (Stub)

> PDF 報告生成模組，具體動作待 Iter 3 完成後細化
> Story 拆法: Story-0 後端 (SVC/API), Story-1 前端串接 (UI/ROUTE)
```

## Iter 分層模型 (VSC-004)

| 層級 | 適用 Iter | 允許的動作類型 | 禁止 |
|------|----------|--------------|------|
| Foundation | Iter 1 | CONST, LIB (配置), ROUTE (前端殼) | SVC 實作, Mock Service, 業務計算 |
| 業務模組 | Iter 2+ | SVC, API, HOOK, UI, ROUTE (完整垂直切片) | 只有後端或只有前端 |

Foundation (Iter 1) 典型動作：
```
| 核心型別定義 | CONST | CoreTypes | P0 | DEFINE→FREEZE→EXPORT |
| 環境配置 | CONST | ENV_CONFIG | P2 | LOAD→VALIDATE→EXPORT |
| API 介面契約 | CONST | IXxxService | P1 | DEFINE→VALIDATE→EXPORT |
| 前端主入口殼 | ROUTE | AppRouter | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES |
```

業務模組 (Iter 2+) Story 拆法：
```
Story-0 (後端先行): SVC/API 實作 → 資料層完成
Story-1 (前端串接): UI/ROUTE 串接後端 → 使用者可操作完整功能
```

## 規模判斷

| 規模 | Stories 上限 | 適用場景 |
|------|-------------|---------|
| S | ≤3 | 單一功能、工具型應用 |
| M | ≤6 | 標準 CRUD 應用、中型系統 |
| L | ≤10 | 多模組企業系統、複雜業務邏輯 |
