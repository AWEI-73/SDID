# {專案名稱} - Blueprint

**日期**: {YYYY-MM-DD}
**規模**: {S/M/L}

<!--
  Blueprint v5 — 全局索引（不含動作細節）
  
  職責：全局地圖 + iter stub 索引
  不含：動作清單、AC、FLOW、DEPS（這些在 per-iter draft）
  
  產出時機：5 輪對話結束後一次性寫出
  更新時機：全授權模式不需更新
  大小上限：~100-150 行（不隨 iter 數膨脹）
-->

---

## 1. 目標

> {貼上原始需求，至少 50 字}

**一句話目標**: {MVP 要達成什麼，至少 10 字}

**不做什麼**:
- {排除項目 1}
- {排除項目 2}

---

## 2. 設計

### 族群
- {角色A}: {職責}（{特殊需求}）
- {角色B}: {職責}（{特殊需求}）

### 實體

#### {EntityA}
| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | string | PK, UUID | 主鍵 |
| name | string | NOT NULL | 名稱 |
| status | enum | 'DRAFT'\|'ACTIVE' | 狀態 |

### 路由結構
```
src/
├── config/
├── shared/types/
├── modules/
│   ├── {moduleA}/
│   └── {moduleB}/
└── index.ts
```

**樣式策略**: {CSS Modules / Tailwind / etc.}

---

## 3. 迭代規劃

| Iter | 模組 | 目標（一行） | 交付 | 狀態 | 可展示標準 |
|------|------|-------------|------|------|-----------|
| 1 | shared | 型別 + API 介面契約 + 前端殼 | INFRA | [CURRENT] | {可觀察的完成標準} |
| 2 | {moduleA} | {一行描述} | FULL | | {可觀察的完成標準} |
| 3 | {moduleB} | {一行描述} | FULL | | {可觀察的完成標準} |

### 模組 API 摘要
- shared: CoreTypes, ENV_CONFIG, I{Service}Contracts
- {moduleA}: {fn}(args): ReturnType, {fn2}(args): ReturnType
- {moduleB}: {fn3}(args): ReturnType

### 已知技術債

| 問題 | 位置 | 嚴重度 | 狀態 |
|------|------|--------|------|
| {技術債描述} | {模組/檔案} | HIGH/MED/LOW | 待處理 / ✅ iter-N 解決 |

---

## 4. 變異點（條件區塊，Simple 時跳過）

| 名詞 | 固定/可變 | 說明 |
|------|----------|------|
| {名詞A} | [固定] | {原因} |
| {名詞B} | [可變] | {何時變} |
