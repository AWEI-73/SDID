# SDID Framework — 設計語意總覽
> 版本：2026-02-21 | 供外部 AI 討論用

---

## 什麼是 SDID？

SDID（Structured Iterative Development）是一套**AI 協作開發的治理框架**，不是程式碼生成器。

它的核心主張：
- AI 生成程式碼很容易，但**讓 AI 持續、可靠、可驗證地完成一個完整專案**很難
- SDID 的角色是**流程守門員（Governor）**，不是程式碼撰寫者
- 所有開發動作都必須通過**門控（Gate）**驗證，確保品質可被量測

---

## 整體架構

```
需求（人類）
    ↓
┌─────────────────────────────────────────┐
│           DESIGN 階段（設計路線）           │
│                                         │
│  路線 A：Blueprint（大藍圖）               │
│  → 5 輪結構化對話 → Enhanced Draft        │
│  → blueprint-gate 驗證 → draft-to-plan  │
│                                         │
│  路線 B：Task-Pipe（POC 漸進式）           │
│  → POC Step 1-5 → 需求規格               │
│  → plan-spec-extractor → PLAN          │
└─────────────────────────────────────────┘
    ↓ (匯流到 implementation_plan)
┌─────────────────────────────────────────┐
│           BUILD 階段（共用 Phase 1-8）      │
│                                         │
│  Phase 1：骨架生成 + VSC 垂直切片門控       │
│  Phase 2：主體實作                        │
│  Phase 3：型別與介面                      │
│  Phase 4：單元測試                        │
│  Phase 5：程式碼品質掃描                   │
│  Phase 6：E2E 測試（Level L 才跑）         │
│  Phase 7：整合檢查 + 孤兒 UI 偵測          │
│  Phase 8：迭代建議（iteration_suggestions）│
└─────────────────────────────────────────┘
    ↓
可用的功能（使用者實際能操作）
```

---

## 核心設計哲學

### 1. Vertical Slice Architecture（垂直切片）

每個 Story 必須是一個**使用者可以實際使用的完整功能切片**，不是技術零件的堆積。

```
❌ 錯誤：iter 只寫了 Service + Hook + UI，但沒有路由
         → 使用者跑完還是看不到任何東西

✅ 正確：iter 包含 ROUTE + SVC + UI 全套
         → iter 完成後，使用者可以直接用這個功能
```

**Story 命名語意：**
- `Story X.0`：Foundation（基礎建設 + App 骨架 + 路由殼）
- `Story X.1+`：Feature（完整垂直切片，每個都可以獨立被使用者使用）

### 2. Gate 系統（門控）

SDID 的核心機制是**在流程中的關鍵節點設置 BLOCKER 門控**，讓錯誤越早被攔截越好。

```
Blueprint 路線的門控順序：
  blueprint-gate → Draft 品質門控（VSC、格式、依賴等）
  ↓
  draft-to-plan → 生成 implementation_plan
  ↓
  Phase 1 → VSC 再次驗證（Task-Pipe 路線也在這裡設門）
  ↓
  Phase 7 → 整合驗證（路由接上了嗎？UI 有掛載嗎？）
```

**BLOCKER vs WARN 設計哲學：**
- `BLOCKER`：無法用 `--pass` 跳過，AI 必須修復才能繼續
- `WARN`：建議改善，但不阻擋流程

### 3. Contract-Driven Development（合約驅動）

POC / Draft 不只是「計畫文件」，它是整個 BUILD 的**合約**。

**模組動作清單的完整合約格式：**

| 業務語意 | 類型 | 技術名稱 | 優先級 | 流向 |
|---------|------|---------|--------|------|
| 頁面路由 | ROUTE | /timer → TimerPage | P0 | INIT_APP→DEFINE_ROUTES→MOUNT |
| 計時邏輯 | SVC | TimerService | P0 | INIT→TICK→COMPLETE |
| 倒數 Hook | HOOK | useTimer | P1 | START→TICK→STOP/FINISH |
| 計時介面 | UI | TimerDisplay | P0 | LOAD_STATE→RENDER→BIND_CLICKS |

**類型的語意（Type System）：**
- `ROUTE`：使用者進入點（路由路徑 → 頁面元件）
- `SVC`：業務邏輯（純函式，不依賴 UI）
- `API`：HTTP 端點（只管請求/回應）
- `HOOK`：互動邏輯（React Hook，銜接 SVC 和 UI）
- `UI`：展示元件（只管渲染，邏輯在 Hook）
- `DATA`：資料層（型別定義、儲存合約）
- `CONST`：常數/設定

---

## Blueprint Gate 的驗證規則（v1.3）

Blueprint 路線在進入 BUILD 之前必須通過 `blueprint-gate.cjs`，目前有 **18 類驗證規則**：

| 代碼 | 類別 | 說明 |
|------|------|------|
| FMT-001~007 | 格式完整性 | 必要區塊是否存在 |
| PH-001 | 佔位符偵測 | `{placeholder}` 未替換 |
| STS-001~003 | 草稿狀態 | 必須是 [x] DONE 才能進 Gate |
| TAG-001~004 | 標籤完整性 | techName, priority, flow 格式 |
| FLOW-001~002 | Flow 步驟數 | 3-7 步驟 |
| FLOW-010~011 | Flow 精確度 | 不能全是泛用詞（INIT/PROCESS/RETURN）|
| API-001~002 | API 一致性 | 公開 API ↔ 動作清單對齊 |
| SIG-001~003 | API 簽名完整性 | 參數型別 + 回傳型別 |
| DEP-001 | 依賴無循環 | DFS 偵測 |
| DAG-001 | 迭代 DAG | 不可依賴更晚 iter 的模組 |
| SIZE-001 | 模組大小 | >8 動作建議拆分 |
| STUB-001~002 | Stub 最低資訊 | 描述 + 依賴 |
| CONS-001~002 | 計劃一致性 | 迭代規劃表 ↔ 動作清單同步 |
| LVL-001 | Level 限制 | S≤3, M≤6, L≤10 模組 |
| EVO-001~002 | 演化層依賴 | L(N) 不能依賴 L(N+1) |
| DEPCON-001~002 | 依賴一致性 | 三處依賴標注同步 |
| LOAD-001 | 迭代負載 | 單 iter 模組數限制 |
| **VSC-001~002** | **垂直切片** | **Foundation 建議有路由殼；Feature 必須有 ROUTE+SVC+UI** |

---

## Phase 7 整合檢查的核心邏輯

Phase 7 是 BUILD 最後一道整合防線，有兩套並行機制：

### A. 路由整合檢查
掃描 `src/` 下的 `*Page.tsx` 或 `pages/` 目錄，確認它們有被 import 進 `App.tsx` 的路由定義中。

### B. 孤兒 UI 組件檢查（v5.2）
**觸發條件**：這個 iter 沒有 Page 元件，但新增了 UI 元件（沒有寫路由的情境）

**掃描範圍**：
- `src/components/`（根層，AI 最常放這裡）
- `src/shared/components/`
- `src/modules/*/components/`（遞迴）

**掛載偵測（5 種模式）**：
```javascript
/import\s+ComponentName\s+from/i         // 預設匯入
/import\s*\{[^}]*\bComponentName\b[^}]*\}/ // 命名匯入
/<ComponentName[\s/>]/                    // JSX 使用
/createElement\s*\(\s*ComponentName/      // React.createElement
/src=["'][^"']*component-name["']/i      // Vanilla script src
```

**結果**：任一 UI 元件完全沒有被掛載 → **BLOCKER**

---

## 技術棧支援策略

目前 SDID 的驗證邏輯對技術棧有以下假設：

**官方支援（React + Vite）**
- Phase 7 路由偵測：`react-router` / `<Route path=`
- Phase 1 骨架：`App.tsx` + `main.tsx` + `vite.config.ts`

**已知盲點**
- Task-Pipe 的 `package.json` 設定為 `"type": "commonjs"`（為了 Jest），與 Vite ESM 有衝突
- 建議：Foundation Story 應在 `package.json` 做模組類型的明確分離

**未來方向：Driver Pattern**
```
Phase 7 內部做成「驗證 Driver」架構：
  detectStack() → "react-vite" | "react-next" | "vue" | "vanilla"
  runDriver("react-vite").checkRoutes()
  runDriver("vanilla").checkUIBind()
```
每個 Driver 只負責自己的技術棧，互不干擾。

---

## 記憶與持久化（GEMS 系統）

每個 SDID 專案下的 `.gems/` 目錄是專案的「神經系統」：

```
.gems/
├── project-memory.json        # 專案狀態機（AI 的工作記憶）
└── iterations/
    └── iter-X/
        ├── poc/               # POC 階段產物（需求 Draft）
        ├── plan/              # PLAN 階段產物（implementation_plan）
        ├── build/             # BUILD 階段產物（iteration_suggestions）
        └── logs/              # 各 Phase 的執行 log
```

**`project-memory.json` 的關鍵欄位：**
- `currentIteration`：目前在哪個 iter
- `currentStory`：目前在跑哪個 Story
- `completedPhases`：哪些 Phase 已通過
- `lastSignal`：上一個工具的輸出信號（PASS / BLOCKER / PENDING）

---

## 目前已知缺口與待改進項目

### 1. 路由合約驗證（計劃中）
Blueprint Draft 中的路由規劃（Section 5）和程式碼之間沒有門控對齊。
→ 未來方向：Phase 1 讀取 Draft 的路由段，和程式碼交叉驗證。

### 2. API 端點合約（未實作）
Task-Pipe 和 Blueprint 的 Plan 都可以宣告 API 端點，但沒有工具驗證「宣告的 API 是否真的被實作」。

### 3. Task-Pipe VSC 的 Plan 格式相依性
Task-Pipe Phase 1 的 VSC 掃描依賴 Plan 表格的 `| TYPE |` 格式，如果 AI 寫的 Plan 格式略有不同就可能漏掉。
→ 待強化：更 robust 的 Plan 解析器。

### 4. Level M 跳過 Phase 6&7 的副作用
為了速度，Level M 預設跳過 E2E 和整合檢查，導致路由問題要等很晚才被發現。
→ 討論點：是否讓 Phase 7 的孤兒檢查在 Level M 也強制跑？

---

## 與其他框架的比較

| 特性 | SDID | BMad Method | 傳統 Prompt Engineering |
|-----|------|-------------|----------------------|
| 路由強制 | Gate（BLOCKER） | Acceptance Criteria | 無 |
| 垂直切片 | VSC Gate | Story 定義 | 無 |
| 記憶持久化 | project-memory.json | 無 | 無 |
| 技術棧相依 | 部分（react-vite） | 無 | 無 |
| AI 行為約束 | BLOCKER 機制 | Acceptance Criteria | 無 |
| 設計文件 | Enhanced Draft（活藍圖） | PRD + Story | 無 |

---

## 適合討論的問題

1. **VSC 的邊界**：什麼情況下 Feature Story 不需要 ROUTE？（例如純後端 API、純資料遷移）
2. **Driver Pattern 的優先級**：先支援 Next.js 還是 Vue？評估標準？
3. **Level 設計**：M 跳過 Phase 7 的決定是否應該重新評估？或者增加 Level ML（Medium-Large）？
4. **Blueprint vs Task-Pipe 的邊界**：現在的判斷標準是需求明不明確，有沒有更精確的切分？
5. **AI 自主決策的範圍**：哪些決定應該讓 AI 自行做、哪些一定要問人？

---

*文件根據 2026-02-21 當日開發討論整理，反映 SDID v1.3 的實際狀態。*
