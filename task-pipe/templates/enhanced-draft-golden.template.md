# 📋 {專案名稱} - 需求草稿 (Enhanced Blueprint Draft)

**迭代**: iter-1  
**日期**: {YYYY-MM-DD}  
**草稿狀態**: [~] PENDING  
**規模**: {S/M/L}  
**方法論**: SDID v1.0

---

## 用戶原始需求

> {貼上原始 PRD 或需求描述，至少 50 字。}
> {描述系統要解決什麼問題、目標客群、技術偏好等。}

---

## 一句話目標

{用一句話描述 MVP 要達成什麼，至少 10 字，不可含佔位符}

---

## 🏗️ 模組化設計藍圖

<!--
  架構原則 (Modular Architecture):
  - 橫向分層 (Horizontal Layers): Config → Assets → Lib → Shared → Modules → Routes
  - 垂直分片 (Vertical Slices): 每個 Module 是獨立微型應用
  - 依賴方向: 只能向下依賴，禁止循環依賴
  - 模組間溝通: 必須透過 index.ts (Facade) 暴露公開 API
-->

### 1. 族群識別

| 族群名稱 | 描述 | 特殊需求 |
|---------|------|---------|
| {角色A} | {職責描述} | {特殊業務邏輯} |
| {角色B} | {職責描述} | {特殊業務邏輯} |

### 2. 實體定義 (Entity Tables)

<!-- 
  每個實體一個 #### 子標題，欄位用表格列出。
  型別: string / number / boolean / enum / Date
  約束: PK / FK → X.id / NOT NULL / UNIQUE / VARCHAR(N) / >= 0 / COMPUTED
-->

#### {EntityA}
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| name | string | NOT NULL, VARCHAR(100) | 名稱 |
| status | enum | 'DRAFT'\|'ACTIVE'\|'ARCHIVED' | 狀態 |
| createdAt | Date | NOT NULL | 建立時間 |

#### {EntityB}
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| entityAId | string | FK → EntityA.id | 關聯 EntityA |
| value | number | NOT NULL, >= 0 | 數值 |

### 3. 共用模組 (Shared)

<!--
  對應橫向分層的 Config + Lib + Shared 層
  - Config: 環境變數、全域常數 (src/config/)
  - Lib: 第三方庫封裝 (src/lib/)
  - Shared: 跨模組共用邏輯 (src/shared/)
    - components/: 原子元件 (Button, Input, Card)
    - layouts/: 頁面佈局 (MainLayout, AuthLayout)
    - hooks/: 通用 Hooks (useDebounce, useWindowSize)
    - store/: 全域狀態 (UserSession, Theme)
    - utils/: 純函數工具 (formatDate, validateEmail)
    - types/: 共用型別定義
-->

- [x] 基礎建設 (types, config, constants)
- [ ] 儲存層封裝 (CRUD 操作)
- [ ] 通用 UI 元件 (表單、表格、通知)

### 4. 獨立模組 (Modules)

<!-- 
  對應垂直分片的 Modules 層 (src/modules/)
  每個模組是獨立微型應用，標準內部結構：
  
  src/modules/{moduleName}/
  ├── index.ts        # 唯一公開 API 入口 (Facade)
  ├── constants.ts    # 模組內常數
  ├── types/          # Domain Models & DTOs
  ├── api/            # 純 API 呼叫 (Fetch/Axios)
  ├── services/       # 純業務邏輯/資料轉換 (非 React)
  ├── hooks/          # 業務邏輯 Hooks
  ├── components/     # 模組專用元件
  └── pages/          # 路由頁面入口
  
  依賴規則：
  - ✅ 可依賴: shared, config, lib
  - ❌ 禁止: 直接 import 其他模組內部檔案
  - ✅ 正確: import { X } from '../other-module' (透過 index.ts)
  
  複雜模組 (>15 檔案) 可加 features/ 子目錄拆分
-->

#### 模組：{moduleA} ({中文名稱})
- 依賴: [shared/types, shared/storage]
- 獨立功能:
  - [x] {已確認的功能描述}
  - [x] {已確認的功能描述}
  - [ ] {待定的功能描述}

#### 模組：{moduleB} ({中文名稱})
- 依賴: [shared/types, moduleA]
- 獨立功能:
  - [x] {已確認的功能描述}
  - [ ] {待定的功能描述}

### 5. 路由結構

<!--
  對應橫向分層的 Routes 層 (src/routes/)
  路由只依賴 Modules 和 Shared，不含業務邏輯
-->

```
src/
├── config/          → 全域配置 (不依賴其他層)
├── assets/          → 靜態資源
├── lib/             → 第三方庫封裝 (僅依賴 config)
├── shared/          → 跨模組共用 (依賴 config, lib)
│   ├── components/  → 原子元件
│   ├── layouts/     → 頁面佈局
│   ├── hooks/       → 通用 Hooks
│   ├── store/       → 全域狀態
│   ├── utils/       → 純函數工具
│   └── types/       → 共用型別
├── modules/         → 核心業務 (依賴 shared, config, lib)
│   ├── {moduleA}/   → {模組A 中文名}
│   └── {moduleB}/   → {模組B 中文名}
├── routes/          → 路由定義 (依賴 modules, shared)
└── index.ts         → 應用入口
```

---

## 📅 迭代規劃表 (Iteration Planning)

<!--
  規則:
  - 同 Iter 內、依賴不互相引用的模組 → 可並行 (Multi-Agent Ready)
  - 依賴欄位填「無」表示無依賴
  - shared 永遠在 Iter 1
-->

| Iter | 範圍 | 目標 | 模組 | 依賴 |
|------|------|------|------|------|
| 1 | Foundation | 型別 + 配置 + 儲存層 | shared | 無 |
| 2 | Core MVP | {核心業務功能} | {moduleA} | shared |
| 3 | Extension | {擴展功能} | {moduleB} | shared, {moduleA} |

> deps=[] 的模組可並行開發 (Multi-Agent Ready)

---

## 📋 模組動作清單 (Module Actions)

<!--
  填充等級:
  - Full: 所有動作都列出 (準備開發的模組)
  - Partial: 部分動作列出 (確定資料結構但功能待定)
  - Stub: 只有描述 (初期探索、不確定的模組)
  
  類型對應模組內部結構:
  | 類型   | 對應目錄      | 說明                    |
  |--------|--------------|------------------------|
  | CONST  | constants.ts | 常數/配置               |
  | LIB    | lib/ 或 api/ | 第三方庫封裝/API 呼叫    |
  | API    | api/         | 純 HTTP 請求 (DTO 接收)  |
  | SVC    | services/    | 純業務邏輯/資料轉換       |
  | HOOK   | hooks/       | 互動邏輯 (React Hook)    |
  | UI     | components/  | 介面元件                 |
  | ROUTE  | pages/       | 路由頁面入口             |
  | SCRIPT | scripts/     | 部署/建置腳本            |
  
  優先級: P0 (端到端協議) | P1 (整合依賴) | P2 (獨立功能) | P3 (輔助功能)
  流向: 用 → 連接的步驟描述 (對應 GEMS-FLOW)
  
  關鍵規則:
  - API 與 Service 分離: API 只管 HTTP，Service 管資料轉換
  - DTO vs Domain Model: 在 Service 層轉換，保護 UI 不受後端變更影響
  - Hooks 優先: 邏輯從 UI 抽離至 hooks/，UI 只負責渲染
-->

### Iter 1: shared

| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |
|---------|------|---------|--------|------|
| 核心型別定義 | CONST | CoreTypes | P0 | DEFINE → FREEZE → EXPORT |
| 環境變數管理 | CONST | ENV_CONFIG | P2 | LOAD → VALIDATE → EXPORT |
| 儲存層封裝 | LIB | storage | P1 | INIT → CRUD_OPS → EXPORT |

### Iter 2: {moduleA}

| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |
|---------|------|---------|--------|------|
| {業務動作描述} | API | {techName} | P0 | {STEP1 → STEP2 → STEP3} |
| {資料轉換描述} | SVC | {techName} | P1 | RECV_DTO → MAP_MODEL → EXPORT |
| {互動邏輯描述} | HOOK | {useSomething} | P1 | CALL_API → UPDATE_STATE → RENDER |
| {介面元件描述} | UI | {ComponentName} | P0 | LOAD_DATA → RENDER → BIND_EVENTS |

### Iter 3: {moduleB} (Stub)

> {模組描述}，具體動作待 Iter 2 完成後細化

---

## 功能模組清單

<!-- 至少勾選 2 個 (含基礎建設) -->
- [x] 基礎建設 (types, config, storage)
- [x] {moduleA 核心功能描述}
- [ ] {moduleB 擴展功能描述}

### 不做什麼

- {明確排除項目 1}
- {明確排除項目 2}

---

## 釐清項目

### 使用者角色
- [x] 主要使用者：{描述主要使用者及其職責}
- [x] 次要使用者：{描述次要使用者及其職責}

### 核心目標
- [x] 解決問題：{描述要解決的核心問題}
- [x] 預期效益：{描述預期帶來的效益}

### 資料結構
- [x] 核心實體：{列出上方定義的實體名稱}

### 邊界條件
- [x] 資料量限制：{描述預期資料量}
- [x] 同時操作：{描述並發需求}

---

## POC 驗證模式

**Level**: {S/M/L}

<!--
  S (≤3 Stories): 單一功能、工具型應用
  M (≤6 Stories): 標準 CRUD 應用、中型系統
  L (≤10 Stories): 多模組企業系統、複雜業務邏輯
-->

---

**草稿狀態**: [~] PENDING
