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
```

## 規模判斷

| 規模 | Stories 上限 | 適用場景 |
|------|-------------|---------|
| S | ≤3 | 單一功能、工具型應用 |
| M | ≤6 | 標準 CRUD 應用、中型系統 |
| L | ≤10 | 多模組企業系統、複雜業務邏輯 |
