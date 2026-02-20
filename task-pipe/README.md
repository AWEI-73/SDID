你# Task-Pipe

任務傳輸桶模式 - 用腳本 print 驅動 AI 執行 GEMS 流程

**版本**: v2.2 (防膨脹版)

## 核心概念

```
腳本 print → AI 讀取 → AI 執行 → 重複直到 @PASS
```

## v2.2 新功能：防膨脹機制 🆕

### 問題背景
POC 階段常見「寫的故事太美，現實成本太貴」的問題 - Spec 承諾的功能遠超過 POC 實際驗證的範圍。

### 解決方案

#### 1. `@GEMS-VERIFIED` 標籤（必填）
POC 必須明確標註哪些功能已實作、哪些未實作：

```html
<!--
  @GEMS-VERIFIED: (此 POC 驗證的功能)
  - [x] 產品列表顯示
  - [x] 新增產品功能
  - [x] 刪除產品功能
  - [ ] 產品編輯功能 (未實作)
  - [ ] 搜尋篩選功能 (未實作)
-->
```

#### 2. 證據導向 Spec 生成
Step 3 會讀取 `@GEMS-VERIFIED` 標籤：
- `[x]` 已驗證 → 放入 iter-1，標註「已驗證」
- `[ ]` 未驗證 → 標註 DEFERRED 或「計畫開發」

#### 3. 等級限制 (Level Constraints)
| Level | 最大 Stories | Story 0 範圍 | 未驗證功能處理 |
|-------|-------------|--------------|---------------|
| S | 3 | 必要型別 + Mock | 自動 DEFERRED |
| M | 6 | 專案骨架 + 配置 | 標註計畫開發 |
| L | 10 | 完整基礎建設 | 允許進入 iter-1 |

## 迭代啟動前置作業

### 🌱 綠地專案 (Greenfield) - 全新專案

**必要資訊清單**：
| 項目 | 說明 | 範例 |
|------|------|------|
| 專案名稱 | 專案識別名稱 | `my-calculator` |
| 迭代編號 | 從 iter-1 開始 | `iter-1` |
| 專案規模 | S/M/L | `M` |
| 技術棧 | 語言/框架 | `TypeScript + React` |
| 需求描述 | 要做什麼 | 見下方 draft 模板 |

**啟動步驟**：
```bash
# 1. 建立專案目錄
mkdir my-project && cd my-project

# 2. 建立 .gems 結構
mkdir -p .gems/iterations/iter-1/poc

# 3. 建立 requirement_draft (見下方模板)

# 4. 執行 POC Step 0
node task-pipe/runner.cjs --phase=POC --step=0 --target=. --level=M
```

### 🏗️ 棕地專案 (Brownfield) - 既有專案

**必要資訊清單**：
| 項目 | 說明 | 範例 |
|------|------|------|
| 專案路徑 | 既有專案位置 | `./existing-app` |
| 迭代編號 | 接續或新開 | `iter-2` |
| 專案規模 | S/M/L | `M` |
| 現有架構 | src 結構說明 | `src/modules/...` |
| 需求描述 | 新增/修改什麼 | 見下方 draft 模板 |
| 相依資訊 | 影響哪些模組 | `calculator, storage` |

**啟動步驟**：
```bash
# 1. 進入專案目錄
cd existing-app

# 2. 建立新迭代目錄
mkdir -p .gems/iterations/iter-2/poc

# 3. (可選) 掃描現有結構
node task-pipe/runner.cjs --phase=SCAN --target=.

# 4. 建立 requirement_draft (見下方模板，需包含相依資訊)

# 5. 執行 POC Step 0
node task-pipe/runner.cjs --phase=POC --step=0 --target=. --iteration=iter-2
```

### 📝 Requirement Draft 模板

```markdown
# Requirement Draft - iter-X

## 狀態
⏳ PENDING

## 專案資訊
- 專案類型: 綠地 / 棕地
- 技術棧: TypeScript + React
- 專案規模: M

## 需求描述
<!-- 清楚描述要做什麼 -->

## 釐清項目
- [ ] 使用者角色：誰會使用這個功能？
- [ ] 核心目標：要解決什麼問題？
- [ ] 資料結構：需要哪些資料？
- [ ] 邊界條件：有什麼限制或例外？

## 相依資訊 (棕地專案必填)
- 影響模組: 
- 現有介面: 
- 資料庫變更: 

## 備註
```

---

## 快速開始

### 1. 建立需求草稿

先在專案目錄建立 `.gems/iterations/iter-1/poc/requirement_draft_iter-1.md`：

```markdown
# Requirement Draft - iter-1

## 狀態
⏳ PENDING

## 需求描述
我想要一個計算機應用程式...

## 釐清項目
- [x] 使用者角色：一般使用者
- [x] 核心目標：執行基本四則運算
- [x] 資料結構：運算式、結果
- [x] 邊界條件：除以零處理

## 備註
```

### 2. 執行流程

```bash
# POC 階段 (Step 0 → 0.5 → 1 → 2 → 3)
node task-pipe/runner.cjs --phase=POC --step=0 --target=.      # 模糊消除
node task-pipe/runner.cjs --phase=POC --step=0.5 --target=.    # 邏輯預檢
node task-pipe/runner.cjs --phase=POC --step=1 --target=.      # 契約設計
node task-pipe/runner.cjs --phase=POC --step=2 --target=.      # UI 原型 + @GEMS-VERIFIED
node task-pipe/runner.cjs --phase=POC --step=3 --target=.      # 需求規格 (防膨脹)

# PLAN 階段 (Step 1 → 2 → 2.5 → 2.6 → 3)
node task-pipe/runner.cjs --phase=PLAN --step=1 --target=.     # 需求確認
node task-pipe/runner.cjs --phase=PLAN --step=2 --target=.     # 規格注入
node task-pipe/runner.cjs --phase=PLAN --step=2.5 --target=.   # 架構審查
node task-pipe/runner.cjs --phase=PLAN --step=2.6 --target=.   # 標籤規格
node task-pipe/runner.cjs --phase=PLAN --step=3 --target=.     # 實作計畫

# BUILD 階段 (Phase 1-7)
node task-pipe/runner.cjs --phase=BUILD --step=1 --target=.    # 骨架生成
# ... Phase 2-7 依序執行
```

### 3. 專案規模選擇

```bash
# S (Small) - 快速原型，最多 3 Stories，未驗證功能自動 DEFERRED
node task-pipe/runner.cjs --phase=POC --step=0 --target=. --level=S

# M (Medium) - 標準流程，最多 6 Stories (預設)
node task-pipe/runner.cjs --phase=POC --step=0 --target=. --level=M

# L (Large) - 嚴格模式，最多 10 Stories
node task-pipe/runner.cjs --phase=POC --step=0 --target=. --level=L
```

## 錨點系統

| 錨點 | 用途 |
|------|------|
| `@CONTEXT` | 當前狀態說明 |
| `@RULES` | 必須遵守的規則 |
| `@TASK` | 需要執行的任務 |
| `@TEMPLATE` | 可複製的模板 |
| `@OUTPUT` | 產出位置與下一步 |
| `✅ PASS` | 通過標記 |
| `❌ BLOCKER` | 卡住標記 |

## GEMS 標籤系統

### POC 階段必填標籤

| 標籤 | 用途 | 範例 |
|------|------|------|
| `@GEMS-STORY` | Story 關聯 | `@GEMS-STORY: Story-1.0 (基礎建設)` |
| `@GEMS-CONTRACT` | 資料契約 | 含 DB 型別註解的 interface |
| `@GEMS-TABLE` | 表名 | `@GEMS-TABLE: tbl_products` |
| `@GEMS-VERIFIED` | 🆕 v2.2 驗證清單 | `[x]` 已驗證 / `[ ]` 未驗證 |
| `@GEMS-DESIGN-BRIEF` | 🆕 v2.3 設計簡報 | Tone/Palette/Typography/Signature |

### @GEMS-VERIFIED 格式

```html
<!--
  @GEMS-VERIFIED: (此 POC 驗證的功能)
  - [x] 產品列表顯示
  - [x] 新增產品功能
  - [ ] 編輯功能 (未實作)
-->
```

### @GEMS-DESIGN-BRIEF 格式 (v2.3 新增)

```html
<!--
  @GEMS-DESIGN-BRIEF:
  - Tone: Industrial Minimalist (工業極簡)
  - Palette: Zinc-900 + Lime-400 (深灰底 + 螢光綠強調)
  - Typography: JetBrains Mono + Plus Jakarta Sans
  - Signature: 斜切角卡片、掃描線動畫
-->
```

### 🚫 Anti-AI-Slop 檢查 (v2.3 新增)

| 類別 | ❌ 禁止 | ✅ 替代 |
|------|--------|--------|
| 字體 | Inter, Roboto, Arial | Geist, Plus Jakarta Sans, JetBrains Mono |
| 配色 | 紫色漸層 + 白底 | 大膽單色系、對比強烈雙色 |
| 圓角 | 全部 `rounded-lg` | 混合 sharp + rounded |
```

## 產物目錄結構

```
專案根目錄/
├── .gems/
│   └── iterations/
│       └── iter-X/
│           ├── poc/                    # POC 產物
│           │   ├── requirement_draft_iter-X.md
│           │   ├── requirement_spec_iter-X.md
│           │   ├── xxxPOC.html
│           │   └── xxxContract.ts
│           ├── plan/                   # PLAN 產物
│           │   ├── implementation_plan_Story-X.Y.md
│           │   └── architecture_audit.md
│           └── build/                  # BUILD 產物
│               ├── Fillback_Story-X.Y.md
│               └── iteration_suggestions_Story-X.Y.json
└── src/                                # 實際程式碼
```

## Task-Pipe 目錄結構

```
task-pipe/
├── runner.cjs              # 主入口
├── config.json             # 配置
├── AGENT_PROMPT.md         # AI 執行指令
├── phases/                 # 各階段驗證器
│   ├── poc/                # POC Step 0, 0.5, 1, 2, 3
│   ├── plan/               # PLAN Step 1, 2, 2.5, 2.6, 3
│   ├── build/              # BUILD Phase 1-7
│   └── scan/               # SCAN
├── lib/                    # 共用函式庫
├── state/                  # 狀態管理
└── stress-tests/           # 壓力測試案例
```

---

## 🧠 BlueMouse 整合

已整合 BlueMouse 的核心功能（純 JavaScript，無需 Python）：

- ✅ **蘇格拉底問題生成**（POC Step 0）- 自動生成領域專家問題
- ✅ **8+3 層代碼驗證**（BUILD Phase 6）- 可選的代碼質量檢查
- ✅ **知識庫**（70 個精選問題，8 個領域）

**快速測試**:
```bash
node task-pipe/test-socratic-demo.cjs
```

**詳細文檔**: [BlueMouse 快速開始](BLUEMOUSE_QUICK_START.md)

---

## 相關文件

- [BlueMouse 整合指南](docs/BLUEMOUSE_GUIDE.md) - BlueMouse 完整文檔
- [GUIDE.md](GUIDE.md) - 完整指南

---

**狀態**: 🚧 開發中 | **版本**: v2.3 (含 BlueMouse 整合)
