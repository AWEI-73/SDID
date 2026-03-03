# 📋 SDID Blueprint Lab - 任務管理系統 - 活藍圖 (Living Blueprint)

**迭代**: iter-1
**日期**: 2026-03-03
**藍圖狀態**: [~] ACTIVE
**規模**: S
**方法論**: SDID v2.1

---

## 用戶原始需求

使用者需要一個簡單的介面來管理日常任務。系統必須能夠條列出所有任務，每項任務應包含標題、當前狀態及建立時間。使用者可以隨時新增任務，並能透過簡單的操作切換任務的「待辦」或「完成」狀態，或是將不再需要的任務刪除。整個系統開發過程需要遵循 SDID 藍圖品質門控 (BLUEPRINT-GATE) 進行驗證。

---

## 一句話目標

建立一個基於 Blueprint 模式的極簡任務管理系統，驗證新版 SDID MCP 整合流程並提升代碼可維護性。

---

## 🏗️ 模組化設計藍圖

### 1. 族群識別

| 族群名稱 | 描述 | 特殊需求 |
|---------|------|---------|
| 使用者 | 終端操作者，負責管理自己的任務清單 | 簡單直覺的介面、即時的狀態切換 |

### 2. 實體定義 (Entity Tables)

#### Task
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 唯一識別碼 |
| title | string | NOT NULL | 任務標題 |
| status | enum | 'todo'\|'done' | 任務狀態 |
| createdAt | number | NOT NULL | 建立時間戳記 |

### 3. 共用模組 (Shared)

- [x] 基礎建設 (types, config, constants)
- [ ] 儲存層封裝 (localStorage 操作)
- [ ] 通用 UI 元件 (Button, Card, Input)

### 4. 獨立模組 (Modules)

#### 模組：TaskModule (任務管理)
- 依賴: [shared/types, shared/storage]
- 公開 API (index.ts):
  - TaskPage(): UI
  - addTask(title: string): Task
  - getTasks(): Task[]
- 獨立功能:
  - [x] 任務列表頁面視圖
  - [x] 任務增刪與狀態切換邏輯
  - [x] 任務排序機制

### 5. 路由結構

```
src/
├── config/          → 全域配置
├── shared/          → 跨模組共用
│   ├── types/       → 共用型別
│   └── storage/     → 儲存層 (localStorage)
├── modules/         → 核心業務
│   └── TaskModule/  → 任務管理模組
└── index.ts         → 應用入口
```

---

## 📅 迭代規劃表 (Iteration Planning)

| Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |
|------|------|------|------|------|------|------|
| 1 | Foundation | 型別 + 配置 + 儲存層 | shared | INFRA | 無 | [CURRENT] |
| 2 | Core MVP | 任務列表與頁面展示 | TaskModule | FULL | shared | [STUB] |

---

## 🔄 變異點分析 (Variation Points)

### 名詞分析

| 名詞 | 固定/可變 | 說明 |
|------|----------|------|
| 任務狀態 | [固定] | 僅支援 Todo/Done |
| 排序方式 | [可變] | 初期僅依時間排序，未來可能支援優先級 |

### 分層定義

| 層 | 名稱 | 新增維度 | API 變化 | 對應 Iter |
|----|------|---------|---------|----------|
| BASE | 基礎版 | 無 (全固定) | getTasks(): Task[] | 1 |

### 確認狀態

- [x] BASE: 基礎任務管理功能 — 本次實作

---

## 📋 模組動作清單 (Module Actions)

### Iter 1: shared [CURRENT]

| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 狀態 | 演化 | AC |
|---------|------|---------|---|------|------|------|------|----|
| 核心型別定義 | CONST | CoreTypes | P0 | DEFINE→FREEZE→EXPORT | 無 | ○○ | BASE | AC-1.0 |
| 儲存層服務 | LIB | StorageService | P1 | INIT→GET→SET→EXPORT | [Internal.CoreTypes] | ○○ | BASE | AC-1.1 |
| 全域配置 | CONST | AppConfig | P3 | DEFINE→FREEZE→EXPORT | 無 | ○○ | BASE | - |

### Iter 2: TaskModule [STUB]

> 任務管理模組，提供 UI 與服務
> 預估: 3 個動作 (1×P0, 1×P1, 1×P2)
> 公開 API: TaskPage, addTask, getTasks

---

## ✅ 驗收條件 (Acceptance Criteria)

### Iter 1: shared

**AC-1.0** — CoreTypes 型別定義
- Given: 專案初始化
- When: 匯入 Task 相關型別
- Then: 所有欄位定義正確，TS 編譯通過

**AC-1.1** — 儲存層服務
- Given: 初始化 localStorage
- When: 儲存與讀取資料
- Then: 資料應能正確持久化並取回

---

## 功能模組清單

- [x] 基礎建設 (types, config, storage)
- [ ] 任務管理核心邏輯
- [ ] 任務介面展示

### 不做什麼

- 多使用者權限管理。
- 雲端資料庫備份（僅使用 localStorage）。

---

## 釐清項目

### 使用者角色
- [x] 主要使用者：終端用戶，管理個人待辦事項。

### 核心目標
- [x] 解決問題：提供快速簡單的任務紀錄工具。
- [x] 預期效益：提高個人工作效率。

---

## POC 驗證模式

**Level**: S

---

**藍圖狀態**: [~] ACTIVE
