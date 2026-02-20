# 🚀 Task-Pipe Master Plan

**版本**: 3.5  
**最後更新**: 2026-02-09  
**狀態**: 🟢 Production Ready (閉環完成)

---

## 1. 專案定位

### 1.1 什麼是 Task-Pipe？

Task-Pipe 是一個 **AI-Native 軟體開發流程框架**。

核心理念：**腳本 print → AI 讀取 → AI 執行 → 重複直到 @PASS**

```
┌─────────────────────────────────────────────────────────────┐
│  不是 Plugin，不是 CLI Tool                                  │
│  是一套「照著做就對了」的硬流程                               │
│                                                             │
│  類似 Kiro Skill，但是草民版：                               │
│  - 沒有 UI 配置                                             │
│  - 沒有彈性組合                                             │
│  - 一條路走到底                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 完整閉環 (v3.5)

```
Blueprint Architect Skill (5 輪對話)
        ↓ 產出 Enhanced Draft (requirement_draft_iter-X.md)
    POC (Step 1-5)
        ↓ 產出 requirement_spec + Contract + POC.html
    PLAN (Step 1-5)
        ↓ 產出 implementation_plan
    BUILD (Phase 1-8)
        ↓ 產出 Code + Fillback + iteration_suggestions
    SCAN (全專案掃描)
        ↓ 產出 functions.json + CONTRACT.md
    iteration_suggestions → 下一輪迭代 (回到 Blueprint Architect 或 POC)
```

**從需求到交付，全程有腳本驗證，無需人類手動銜接。**

### 1.2 設計哲學

| 原則 | 說明 |
|------|------|
| **零依賴** | 只需要 Node.js，不需要 npm install |
| **零配置** | 複製資料夾就能用 |
| **硬流程** | POC → PLAN → BUILD → SCAN，不能跳步 |
| **AI 驅動** | 腳本輸出指令，AI 執行，腳本驗證 |
| **Guardrails** | GEMS 標籤系統約束 AI 產出品質 |

### 1.3 與其他工具的差異

| 工具 | 做法 |
|------|------|
| `.cursorrules` | 規則檔，告訴 AI 怎麼寫 code |
| `CLAUDE.md` | 專案說明，給 AI 讀 |
| **Task-Pipe** | 完整工作流 + 驗證腳本 + 狀態追蹤 |


---

## 2. 四階段工作流程

```
┌─────────┐    ┌─────────┐    ┌─────────────────────────┐    ┌─────────┐
│   POC   │ →  │  PLAN   │ →  │         BUILD           │ →  │  SCAN   │
│ 概念驗證 │    │ 規格設計 │    │      實作與測試          │    │ 品質掃描 │
├─────────┤    ├─────────┤    ├─────────────────────────┤    ├─────────┤
│ Step 1  │    │ Step 1  │    │ Phase 1: 開發腳本       │    │ 全專案  │
│ Step 2  │    │ Step 2  │    │ Phase 2: 測試腳本       │    │ 掃描    │
│ Step 3  │    │ Step 3  │    │ Phase 3: TDD 執行       │    │         │
│ Step 4  │    │ Step 4  │    │ Phase 4: 標籤驗收       │    │         │
│ Step 5  │    │ Step 5  │    │ Phase 5: Test Gate      │    │         │
│         │    │         │    │ Phase 6: 修改檔案測試   │    │         │
│         │    │         │    │ Phase 7: 整合檢查       │    │         │
│         │    │         │    │ Phase 8: 完成規格       │    │         │
└─────────┘    └─────────┘    └─────────────────────────┘    └─────────┘
```

### 2.1 POC 階段 (概念驗證)

**目的**: 消除模糊、定義契約、產出可視化原型

| Step | 名稱 | 產出 | 驗證重點 |
|------|------|------|----------|
| **1** | 模糊消除 | `requirement_draft_iter-X.md` | 所有模糊點已列出 |
| **2** | 規模評估 | 更新 draft | 專案規模 S/M/L |
| **3** | 契約設計 | `xxxContract.ts` | @GEMS-CONTRACT + @GEMS-TABLE |
| **4** | UI 原型 | `xxxPOC.html` | @GEMS-VERIFIED + @GEMS-DESIGN-BRIEF |
| **5** | 需求規格 | `requirement_spec_iter-X.md` | Story ≥2, AC 完整 |

**關鍵標籤**:
- `@GEMS-VERIFIED`: 標註哪些功能已實作 `[x]`、哪些未實作 `[ ]`
- `@GEMS-DESIGN-BRIEF`: 設計風格 (Tone/Palette/Typography/Signature)
- `@GEMS-CONTRACT`: 資料契約，含 DB 型別註解

### 2.2 PLAN 階段 (規格設計)

**目的**: 將需求規格拆成可執行的 Implementation Plan

| Step | 名稱 | 產出 | 驗證重點 |
|------|------|------|----------|
| **1** | 需求確認 | Story 選擇 | Spec 存在 |
| **2** | 規格注入 | Plan 草稿 | 目標、工作項目 |
| **3** | 架構審查 | 審查報告 | 模組化結構合規 |
| **4** | 標籤規格 | 標籤模板 | GEMS 標籤完整度 |
| **5** | 需求規格說明 | `implementation_plan_Story-X.Y.md` | @GEMS-CONTRACT 存在 |

### 2.3 BUILD 階段 (實作與測試)

**目的**: 實作程式碼、撰寫測試、驗證標籤

| Phase | 名稱 | 做什麼 | 驗證條件 |
|-------|------|--------|----------|
| **1** | 開發腳本 | 寫功能程式碼 + GEMS 標籤 | getDiagnostics() = 0 |
| **2** | 測試腳本 | 依風險等級撰寫測試 | 測試檔案存在 + 編碼正確 |
| **3** | TDD 執行 | 執行 npm test | passRate = 100% |
| **4** | 標籤驗收 | 驗證 GEMS 標籤完整性 | coverage ≥ 80% |
| **5** | Test Gate | 驗證測試 import 正確 | P0/P1 測試 100% |
| **6** | 修改檔案測試 | 確保修改不破壞現有功能 | 所有測試通過 |
| **7** | 整合檢查 | 檢查 routes/exports/UI Bind | Checklist 完成 ⭐ v3.3 增強 |
| **8** | 完成規格 | 產出 Fillback + Suggestions | 必填欄位驗證 |

### 2.4 SCAN 階段 (品質掃描)

**目的**: 全專案掃描，驗證標籤 + 規格一致性

**產出**:
- `functions.json` - 函式清單 (含行號，支援 Function Slicing)
- `function-index.json` - 快速查詢索引
- `system-blueprint.json` - 系統藍圖
- `contract.json` - Semantic Contract (機器可讀) ⭐ v3.3 新增
- `CONTRACT.md` - Semantic Contract (人類可讀) ⭐ v3.3 新增

**Semantic Contract Layer** (v3.3):
- 整合 Data Contracts (`@GEMS-CONTRACT`)
- 整合 UI Bindings (`@GEMS-UI-BIND`)
- 整合 Functions (GEMS 標籤)
- 產出 Story → Functions → UI → Data 的完整對照表


---

## 3. 目錄結構 (2026-02-06 更新)

### 3.1 Task-Pipe 本體結構

```
task-pipe/
├── runner.cjs                 # 🎯 主入口 - 所有流程從這裡開始
├── config.json                # 設定檔
├── phase-registry.json        # 階段註冊表
│
├── phases/                    # 📦 階段腳本 (核心)
│   ├── poc/                   # POC 階段 (Step 1-5)
│   │   ├── step-1.cjs         # 模糊消除
│   │   ├── step-2.cjs         # 規模評估
│   │   ├── step-3.cjs         # 契約設計
│   │   ├── step-4.cjs         # UI 原型
│   │   ├── step-5.cjs         # 需求規格
│   │   └── CONTENT_QUALITY_GUIDE.md
│   ├── plan/                  # PLAN 階段 (Step 1-5)
│   │   ├── step-1.cjs         # 需求確認
│   │   ├── step-2.cjs         # 規格注入
│   │   ├── step-3.cjs         # 架構審查
│   │   ├── step-4.cjs         # 標籤規格
│   │   └── step-5.cjs         # 需求規格說明
│   ├── build/                 # BUILD 階段 (Phase 1-8)
│   │   ├── phase-1.cjs        # 開發腳本
│   │   ├── phase-2.cjs        # 測試腳本
│   │   ├── phase-3.cjs        # TDD 執行
│   │   ├── phase-4.cjs        # 標籤驗收
│   │   ├── phase-5.cjs        # Test Gate
│   │   ├── phase-6.cjs        # 修改檔案測試
│   │   ├── phase-7.cjs        # 整合檢查
│   │   └── phase-8.cjs        # 完成規格
│   └── scan/                  # SCAN 階段
│       └── scan.cjs           # 全專案掃描
│
├── lib/                       # 📚 核心函式庫
│   ├── shared/                # 共用模組
│   │   ├── state-manager-v3.cjs    # 狀態管理 (v3)
│   │   ├── error-handler.cjs       # 錯誤處理 (TACTICAL_FIX)
│   │   ├── log-output.cjs          # 輸出格式化 (錨點系統)
│   │   ├── retry-strategy.cjs      # ⭐ v3.4 策略漂移
│   │   ├── taint-analyzer.cjs      # ⭐ v3.4 染色分析
│   │   ├── incremental-validator.cjs # ⭐ v3.4 增量驗證
│   │   ├── backtrack-router.cjs    # ⭐ v3.4 回溯路由
│   │   ├── next-command-helper.cjs # 下一步指令生成
│   │   ├── project-type.cjs        # 專案類型偵測
│   │   ├── src-path-resolver.cjs   # src 路徑解析
│   │   ├── output-header.cjs       # 輸出標頭
│   │   ├── safe-output.cjs         # 安全輸出
│   │   ├── gems-patterns.cjs       # GEMS 正則模式
│   │   └── phase-registry-loader.cjs
│   ├── scan/                  # 掃描相關
│   │   ├── gems-scanner.cjs        # GEMS 標籤掃描器 (Regex)
│   │   ├── gems-scanner-enhanced.cjs # 增強版 (含行號)
│   │   ├── gems-validator.cjs      # GEMS 驗證器
│   │   ├── gems-validator-lite.cjs # 寬鬆版驗證器
│   │   ├── contract-generator.cjs  # Semantic Contract 生成 ⭐ v3.3 新增
│   │   └── gems-patterns.cjs       # 正則模式
│   ├── plan/                  # PLAN 相關
│   │   └── plan-spec-extractor.cjs # Plan 解析器
│   ├── build/                 # BUILD 相關
│   │   ├── code-validator.cjs      # 程式碼驗證
│   │   ├── encoding-validator.cjs  # 編碼驗證 (UTF-8)
│   │   ├── ui-bind-validator.cjs   # UI Bind 驗證 ⭐ v3.3 新增
│   │   └── executability-validator.cjs
│   ├── auto-fixer/            # 自動修復
│   │   ├── gems-fixer.cjs          # GEMS 標籤修復
│   │   ├── route-fixer.cjs         # 路由修復
│   │   └── test-scaffold.cjs       # 測試骨架
│   ├── scaffold/              # 骨架生成
│   │   ├── index.cjs               # 入口
│   │   ├── generator.cjs           # 生成器
│   │   ├── compliance-check.cjs    # 合規檢查
│   │   ├── hook.cjs                # Hook 整合
│   │   ├── demo.cjs                # Demo
│   │   └── README.md
│   │
│   ├── checkpoint.cjs         # 進度記錄
│   ├── level-gate.cjs         # Level 等級控制
│   ├── suggestions-validator.cjs   # Suggestions 驗證
│   ├── step-consistency-validator.cjs
│   ├── step-result.cjs        # Step 結果記錄
│   ├── error-classifier.cjs   # 錯誤分類
│   ├── stress-test-runner.cjs # 壓力測試執行器
│   ├── stress-test-integration.cjs
│   ├── security-checker.cjs   # 安全檢查
│   │
│   ├── socratic-generator.cjs # 🧠 BlueMouse: 蘇格拉底問題生成
│   ├── bluemouse-adapter-v2.cjs    # BlueMouse 適配器
│   ├── knowledge_base.json         # 知識庫 (70 問題, 8 領域)
│   └── gems-scanner-gas.cjs   # GAS 專用掃描器

│
├── tools/                     # 🔧 工具腳本
│   ├── poc/                   # POC 工具
│   │   ├── html-poc-parser.cjs     # HTML POC 解析
│   │   ├── process-html-poc.cjs    # 一鍵處理 POC
│   │   └── migrate-poc-ui.cjs      # UI 遷移
│   ├── plan/                  # PLAN 工具
│   │   ├── plan-validator.cjs      # Plan 驗證
│   │   ├── generate-plan-templates.cjs
│   │   └── story-number-advisor.cjs
│   ├── build/                 # BUILD 工具
│   │   ├── env-checker.cjs         # 環境檢查
│   │   ├── init-project.cjs        # 專案初始化
│   │   ├── route-fixer.cjs         # 路由修復
│   │   └── scaffold-files.cjs      # 骨架檔案
│   ├── scan/                  # SCAN 工具
│   │   ├── gems-scanner.cjs        # GEMS 掃描
│   │   └── gems-full-scanner.cjs   # 完整掃描
│   ├── quality-check/         # 品質檢查
│   │   ├── content-quality-checker.cjs
│   │   └── poc-quality-checker.cjs
│   ├── auto-runner/           # 自動執行器
│   │   ├── index.cjs               # 入口
│   │   ├── GUIDE.md
│   │   ├── install.bat
│   │   └── package.json
│   ├── optimization-reporter/ # 優化報告
│   │   ├── index.cjs
│   │   ├── README.md
│   │   ├── PASTE_THIS.md
│   │   └── reports/           # 報告輸出
│   │
│   ├── story-status.cjs       # Story 狀態查詢
│   ├── force-commands.cjs     # 強制指令
│   ├── generate-context.cjs   # 🌐 跨 IDE: Context 生成器
│   ├── draft-parser.cjs       # ⭐ v3.5 Enhanced Draft 解析器
│   ├── blueprint-runner.cjs   # ⭐ v3.5 藍圖執行器 (使用 draft-parser)
│   ├── blueprint-architect.cjs # ⭐ v3.5 藍圖架構師 SYSTEM_PROMPT + 驗證
│   ├── blueprint-visualizer.cjs # ⭐ v3.5 藍圖視覺化 (MD/JSON→HTML)
│   ├── blueprint-studio.html  # ⭐ v3.5 互動式藍圖工作室 (瀏覽器端)
│   ├── test-anchor-output.cjs # 錨點輸出測試
│   ├── stress-test-evolution.cjs
│   └── README.md
│
├── skills/                    # 🎨 技能插件
│   ├── ralph-loop/            # Ralph Loop (自動執行)
│   │   ├── SKILL.md                # 技能說明
│   │   ├── scripts/
│   │   │   └── loop.cjs            # 主迴圈 (v3)
│   │   └── references/
│   │       └── agent-prompt.md
│   ├── blueprint-architect/   # ⭐ v3.5 藍圖架構師 (5 輪對話)
│   │   ├── SKILL.md                # 技能說明 (含觸發詞、流程)
│   │   └── references/
│   │       ├── architecture-rules.md    # 6 層架構規則
│   │       └── action-type-mapping.md   # 動作類型→目錄對照
│   ├── code-reviewer/         # Code Reviewer (實驗性)
│   │   ├── SKILL.md
│   │   ├── index.cjs
│   │   ├── auto-fixer.cjs
│   │   ├── retry-tracker.cjs
│   │   ├── gems-tag-knowledge.cjs
│   │   ├── analyzers/
│   │   └── fixers/
│   ├── frontend-design/       # 前端設計檢查
│   │   ├── SKILL.md
│   │   └── design-quality-checker.cjs
│   └── README.md
│
├── mcp/                       # 🌐 MCP Server (跨 IDE)
│   └── gems-index-server.cjs  # Function Index 查詢服務
│
├── templates/                 # 📝 模板
│   ├── CLAUDE.md.template     # 跨 IDE 規則模板
│   ├── integration.template.md
│   ├── enhanced-draft-golden.template.md  # ⭐ v3.5 Enhanced Draft 黃金模板
│   ├── poc/                   # POC 範例
│   │   ├── counter-poc.html
│   │   ├── health-poc.html
│   │   └── todo-poc.html
│   └── examples/              # 黃金範例
│       ├── README.md
│       ├── enhanced-draft-ecotrack.example.md  # ⭐ v3.5 EcoTrack 範例
│       ├── poc/
│       │   ├── DesignFirst_POC_GOLD.html
│       │   └── TaskManagerPOC_GOLD.html
│       └── spec/
│           └── requirement_spec_GOLD.md
│
├── stress-tests/              # 🧪 壓力測試
│   ├── runner.cjs             # 測試執行器
│   ├── README.md
│   ├── lib/evaluators/        # 評估器
│   ├── poc/                   # POC 測試案例
│   ├── plan/                  # PLAN 測試案例
│   ├── build/                 # BUILD 測試案例
│   └── scan/                  # SCAN 測試案例
│
├── docs/                      # 📖 文件
│   ├── guides/                # 使用指南
│   │   ├── GEMS_TAG_SYSTEM_v2.md
│   │   ├── gems-tagging-complete-guide.md
│   │   ├── poc-tagging-guide.md
│   │   ├── modular-architecture-guide.md
│   │   └── ...
│   ├── research/              # 研究筆記
│   ├── BLUEMOUSE_GUIDE.md     # BlueMouse 整合
│   ├── FUNCTION_SLICING_GUIDE.md  # Function Slicing
│   ├── EVOLUTION_BLUEPRINT.md
│   └── ...
├── .gems/                     # 自身迭代產物
├── .task-pipe/                # 狀態檔案
│   └── state.json
├── .git/                      # Git
├── .gitignore
│
├── README.md                  # 快速入門
├── GUIDE.md                   # 完整指南
├── MASTER_PLAN.md             # 本文件
├── SYSTEM_OVERVIEW.md         # 系統概覽
├── BLUEMOUSE_QUICK_START.md   # BlueMouse 快速開始
└── test-socratic-demo.cjs     # BlueMouse Demo
```


### 3.2 專案 .gems 結構 (使用者專案)

```
your-project/
├── .gems/
│   └── iterations/
│       └── iter-X/
│           ├── poc/                    # POC 產出
│           │   ├── requirement_draft_iter-X.md
│           │   ├── requirement_spec_iter-X.md
│           │   ├── xxxContract.ts
│           │   └── xxxPOC.html
│           ├── plan/                   # PLAN 產出
│           │   ├── implementation_plan_Story-X.Y.md
│           │   └── architecture_audit.md
│           ├── build/                  # BUILD 產出
│           │   ├── Fillback_Story-X.Y.md
│           │   └── iteration_suggestions_Story-X.Y.json
│           ├── logs/                   # 執行紀錄
│           └── .strategy-state.json    # ⭐ v3.4 策略漂移狀態
├── .task-pipe/
│   └── state.json                      # 狀態追蹤
└── src/                                # 實際程式碼
```

---

## 4. 核心機制詳解

### 4.1 錨點系統 (Anchor System)

所有腳本輸出使用統一錨點格式，讓 AI 能精準解讀：

| 錨點 | 用途 | 範例 |
|------|------|------|
| `@CONTEXT` | 當前狀態 | 目前在哪、檢查結果 |
| `@RULES` | 必須遵守的規則 | 軍規列表 |
| `@TASK` | 需要執行的任務 | 具體指令 |
| `@TEMPLATE` | 可複製的模板 | GEMS 標籤模板 |
| `@OUTPUT` | 產出位置與下一步 | 檔案路徑、下一個指令 |
| `✅ PASS` | 通過標記 | 可進入下一步 |
| `❌ BLOCKER` | 阻塞標記 | 需人類介入 |

### 4.2 錯誤恢復系統 v2.0

#### 4.2.1 策略漂移 (Strategy Drift)

重試不是單純重複，而是「維度的提升」：

| Level | 重試次數 | 策略名稱 | 行動 |
|-------|---------|---------|------|
| 🔧 1 | 1-3 次 | TACTICAL_FIX | 局部修補，在原檔案修復 |
| 🔄 2 | 4-6 次 | STRATEGY_SHIFT | 換個方式實作，考慮重構 |
| ⚠️ 3 | 7+ 次 | PLAN_ROLLBACK | 質疑架構，回退 PLAN 階段 |

**優先級重試上限**:
| Priority | 最大重試 | 升級門檻 |
|----------|---------|---------|
| P0 | 10 次 | 第 4 次升級 |
| P1 | 8 次 | 第 3 次升級 |
| P2 | 5 次 | 第 2 次升級 |
| P3 | 3 次 | 第 2 次升級 |

#### 4.2.2 染色分析 (Taint Analysis)

修改 P0 函式後，自動計算影響範圍：

```bash
# 分析影響範圍
node task-pipe/lib/shared/taint-analyzer.cjs --functions=.gems/docs/functions.json --changed=src/auth.ts
```

**輸出**:
- 直接修改的函式
- 間接受影響的函式 (依賴者)
- 需要驗證的檔案列表

#### 4.2.3 增量驗證 (Incremental Validation)

修改後不需從頭跑，只驗證改動範圍：

| 當前 Phase | 驗證範圍 |
|------------|----------|
| Phase 2+ | 標籤驗證 |
| Phase 5+ | 測試驗證 |
| Phase 7+ | 整合驗證 |

#### 4.2.4 回溯路由 (Backtrack Router)

失敗類型 → 精確回溯目標：

| 失敗類型 | 回溯目標 |
|---------|---------|
| 標籤缺失 | BUILD Phase 2 |
| 測試失敗 | BUILD Phase 3-5 |
| 整合失敗 | BUILD Phase 6-7 |
| 架構問題 | PLAN Step 2-3 |

#### 4.2.5 整合到 Log Output

`anchorError()` 自動輸出策略資訊：

```
@TACTICAL_FIX (2/3) | 測試失敗
@STRATEGY_DRIFT | Level 1/3 | 🔧 TACTICAL_FIX
  策略: 局部修補 - 在原檔案修復
@TAINT_ANALYSIS | 修改 2 個函式 → 影響 5 個依賴者
  受影響檔案: src/auth.ts, src/user.ts, src/api.ts...
@INCREMENTAL_HINT | 建議驗證範圍:
  - 標籤驗證: 檢查受影響檔案的 GEMS 標籤
  - 測試驗證: 跑受影響檔案的測試
修復後: node task-pipe/runner.cjs --phase=BUILD --step=5 ...
```

**狀態追蹤**: 
- `.task-pipe/state.json` - 當前進度
- `.gems/iterations/iter-X/.strategy-state.json` - 策略漂移狀態

### 4.3 Level 等級制度

| Level | 名稱 | BUILD Phases | 適用場景 |
|-------|------|--------------|----------|
| **S** | Prototype | 1, 2, 4, 8 | GAS、快速原型、概念驗證 |
| **M** | Standard | 1-5, 7, 8 | 標準開發流程 (預設) ⭐ v3.3 加入 Phase 7 |
| **L** | Strict | 全部 + 額外檢查 | 企業級、高風險專案 |

### 4.4 State Manager v3

**單一真相來源**: `.task-pipe/state.json`

```json
{
  "currentPhase": "BUILD",
  "currentStep": "phase-4",
  "currentStory": "Story-1.1",
  "iteration": "iter-1",
  "attempts": {
    "BUILD:phase-4:Story-1.1": {
      "count": 2,
      "lastError": "覆蓋率不足",
      "needsHuman": false
    }
  }
}
```


---

## 5. GEMS 標籤系統 v2.4

### 5.1 標籤格式

```typescript
/**
 * GEMS: functionName | P[0-3] | ✓✓ | (args)→Result | Story-X.X | 描述
 * GEMS-FLOW: Step1→Step2→Step3
 * GEMS-DEPS: [Type.Name (說明)], [Type.Name (說明)]
 * GEMS-DEPS-RISK: LOW | MEDIUM | HIGH
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: xxx.test.ts
 */
// [STEP] Step1 (P0/P1 強制，P2/P3 可選)
// [STEP] Step2
// [STEP] Step3
```

### 5.2 @GEMS-UI-BIND (v2.4 新增)

專為 Vanilla JS / 非框架專案設計，標記 HTML-JS 綁定關係：

```typescript
/**
 * @GEMS-UI-BIND: ModuleName
 * - #selector (type) → handler:event
 * - #selector (type) ← initFunction
 */
```

| 符號 | 意義 |
|------|------|
| `→` | 事件綁定 (使用者操作觸發) |
| `←` | 初始化 (頁面載入時填充) |

**Phase 7 驗證**:
- HTML ID 存在
- Handler/Init 函式存在
- Selector 不重複

### 5.3 標籤價值

```
標籤 → 分片 function → 修改局部 → 省 token
```

- **FLOW**: 作為「契約」約束實作步驟，避免 AI 走歪
- **DEPS**: 定義依賴邊界，控制影響範圍
- **UI-BIND**: 讓 HTML-JS 綁定關係顯性化、可驗證
- **行號**: 讓 AI 只讀 30 行而不是 500 行

### 5.4 Function Slicing (保留功能)

SCAN 產出的 `functions.json` 包含行號：

```json
{
  "functions": [{
    "name": "renderBookList",
    "file": "src/ui/tracker.ui.ts",
    "startLine": 45,
    "endLine": 78,
    "priority": "P0",
    "storyId": "Story-2.1"
  }]
}
```

**用途**: AI 可以只讀取特定函式範圍，大幅減少 token 消耗。

---

## 6. 整合功能

### 6.1 BlueMouse 整合

純 JavaScript 實作，無需 Python：

- ✅ **蘇格拉底問題生成** (POC Step 1)
- ✅ **8+3 層代碼驗證** (BUILD Phase 6)
- ✅ **知識庫** (70 問題, 8 領域)

```bash
# 測試
node task-pipe/test-socratic-demo.cjs
```

### 6.2 Ralph Loop (自動執行)

位置: `skills/ralph-loop/`

**功能**:
- 自動執行整個 GEMS 流程
- 支援 `--new` 建立新專案 + 初始化 draft
- 支援 `--force-start` 強制從頭開始
- 狀態追蹤 + 錯誤恢復
- 支援 `--dry-run` 預覽模式

**使用方式**:
```bash
# 新專案 (建立 draft + 開始 POC)
node task-pipe/skills/ralph-loop/scripts/loop.cjs --new --project=my-app --type=todo

# 繼續現有專案
node task-pipe/skills/ralph-loop/scripts/loop.cjs --project=my-app

# 強制從頭開始
node task-pipe/skills/ralph-loop/scripts/loop.cjs --project=my-app --force-start

# 預覽模式
node task-pipe/skills/ralph-loop/scripts/loop.cjs --project=my-app --dry-run
```

**Antigravity 整合**:
- `.agent/skills/ralph-loop/` 為 proxy，轉發到 `task-pipe/skills/ralph-loop/`
- 避免程式碼重複

**禁止行為** (AI 執行時):
- ❌ 執行 `--help` 後停止
- ❌ 執行 `--dry-run` 後停止
- ❌ 讀取 `.cjs` 原始碼

### 6.3 跨 IDE 支援

不使用 Kiro Steering 時的替代方案：

| 方案 | 檔案 | 說明 |
|------|------|------|
| **CLAUDE.md** | `templates/CLAUDE.md.template` | 給 Claude Code/Cursor/Windsurf |
| **MCP Server** | `mcp/gems-index-server.cjs` | Function Index 查詢服務 |
| **Context Generator** | `tools/generate-context.cjs` | 產生文字貼到任何 AI |

### 6.4 Blueprint Architect (藍圖架構師) ⭐ v3.5

位置: `skills/blueprint-architect/`

**定位**: 閉環的起點 — 在 POC 之前，透過 5 輪結構化對話將模糊需求轉化為 Enhanced Draft。

**5 輪對話流程**:

| Round | 焦點 | 產出 |
|-------|------|------|
| 1 | 目標釐清 | 一句話目標 + 族群識別表 |
| 2 | 實體識別 | 實體定義表格 (欄位/型別/約束) |
| 3 | 模組拆分 | 共用模組 + 獨立模組 + 路由結構 |
| 4 | 迭代規劃 | 迭代規劃表 + 不做什麼 |
| 5 | 動作細化 | 模組動作清單 (業務語意→技術名稱) |

**產出**: `requirement_draft_iter-X.md` (Enhanced Draft 格式)

**相關工具**:

| 工具 | 用途 |
|------|------|
| `tools/draft-parser.cjs` | 零依賴 Markdown 解析器，解析 Enhanced Draft |
| `tools/blueprint-runner.cjs` | 藍圖執行器，驗證 + 觸發 POC 流程 |
| `tools/blueprint-architect.cjs` | SYSTEM_PROMPT + `--validate` 驗證模式 |
| `tools/blueprint-visualizer.cjs` | MD/JSON → HTML 視覺化 Dashboard |
| `tools/blueprint-studio.html` | 瀏覽器端互動式工具 (放 API Key 即可跑) |

**使用方式**:
```bash
# 驗證 Enhanced Draft
node task-pipe/tools/blueprint-architect.cjs --validate <draft.md>

# 解析 Draft 結構
node task-pipe/tools/draft-parser.cjs <draft.md>

# 視覺化
node task-pipe/tools/blueprint-visualizer.cjs <draft.md> --output dashboard.html

# 執行藍圖 (驗證 + 觸發 POC)
node task-pipe/tools/blueprint-runner.cjs --project=my-app --iteration=iter-1
```

**Handoff**: Draft 完成後 → Ralph Loop 或手動 `runner.cjs --phase=POC --step=1`


---

## 7. 使用方式

### 7.1 基本執行

```bash
# 偵測專案狀態
node task-pipe/runner.cjs --target=your-project

# POC 階段
node task-pipe/runner.cjs --phase=POC --step=1 --target=your-project --level=M

# PLAN 階段
node task-pipe/runner.cjs --phase=PLAN --step=1 --target=your-project --story=Story-1.0

# BUILD 階段
node task-pipe/runner.cjs --phase=BUILD --step=1 --target=your-project --story=Story-1.1

# SCAN 階段
node task-pipe/runner.cjs --phase=SCAN --target=your-project
```

### 7.2 常用選項

| 選項 | 說明 | 範例 |
|------|------|------|
| `--phase` | 階段 | POC, PLAN, BUILD, SCAN |
| `--step` | 步驟 | 1, 2, 3, 4, 5 (POC/PLAN) 或 1-8 (BUILD) |
| `--target` | 目標專案路徑 | `./my-project` |
| `--story` | Story ID | `Story-1.1` |
| `--iteration` | 迭代編號 | `iter-2` |
| `--level` | 檢查深度 | S, M, L |
| `--ai` | AI 模式 (優化輸出) | - |
| `--dry-run` | 預覽模式 | - |

### 7.3 工具腳本

```bash
# Story 狀態查詢
node task-pipe/tools/story-status.cjs --target=your-project

# POC 一鍵處理
node task-pipe/tools/poc/process-html-poc.cjs your-poc.html

# Plan 驗證
node task-pipe/tools/plan/plan-validator.cjs plan.md

# 壓力測試
node task-pipe/runner.cjs --stress-test=all
```

---

## 8. 軍規總覽

### 8.1 通用軍規

| # | 軍規 | 說明 |
|---|------|------|
| 1 | **禁止腦補** | 模糊需求必須先 `[NEEDS CLARIFICATION]` |
| 2 | **小跑修正** | SEARCH → 修正 → 重試，最多 3 次 |
| 3 | **不跳步** | 所有 Step/Phase 都不能跳 |
| 4 | **Context 管理** | 一個 Agent 一個 Item |
| 5 | **驗證優先** | 每個階段都有 Checkpoint |
| 6 | **獨立可測性** | 每個 Story 必須能被單獨驗證 |

### 8.2 POC 軍規

- 禁止腦補 (Don't Guess)
- 強制視覺驗證 (POC 必須可直接運行)
- 契約先行 (@GEMS-CONTRACT 必須包含 DB 型別註解)
- 無真實 API (只使用 MOCK_DATA)

### 8.3 BUILD 軍規

- 一個 Agent 一個 Story
- 開發腳本先行 (型別檢查 0 errors 才進測試)
- TDD 100% (禁止在測試中重寫函式邏輯)
- 標籤化驗收 (所有函式有 GEMS 標籤)
- 完整執行 Phase 1-7 (不可中途結束)


---

## 9. 檔案清單 (按用途分類)

### 9.1 核心執行

| 檔案 | 用途 | 重要度 |
|------|------|--------|
| `runner.cjs` | 主入口 | ⭐⭐⭐ |
| `phases/poc/*.cjs` | POC 階段腳本 | ⭐⭐⭐ |
| `phases/plan/*.cjs` | PLAN 階段腳本 | ⭐⭐⭐ |
| `phases/build/*.cjs` | BUILD 階段腳本 | ⭐⭐⭐ |
| `phases/scan/scan.cjs` | SCAN 階段腳本 | ⭐⭐⭐ |

### 9.2 核心函式庫

| 檔案 | 用途 | 被誰使用 |
|------|------|----------|
| `lib/shared/state-manager-v3.cjs` | 狀態管理 | runner, ralph-loop |
| `lib/shared/error-handler.cjs` | 錯誤處理 | 所有 phase 腳本 |
| `lib/shared/log-output.cjs` | 錨點輸出 | 所有 phase 腳本 |
| `lib/shared/retry-strategy.cjs` | 策略漂移 ⭐ v3.4 | log-output |
| `lib/shared/taint-analyzer.cjs` | 染色分析 ⭐ v3.4 | log-output |
| `lib/shared/incremental-validator.cjs` | 增量驗證 ⭐ v3.4 | log-output |
| `lib/shared/backtrack-router.cjs` | 回溯路由 ⭐ v3.4 | log-output |
| `lib/scan/gems-validator-lite.cjs` | 標籤驗證 | phase-4 |
| `lib/plan/plan-spec-extractor.cjs` | Plan 解析 | phase-4, phase-7 |
| `lib/checkpoint.cjs` | 進度記錄 | 所有 phase 腳本 |
| `lib/level-gate.cjs` | Level 控制 | runner |

### 9.3 工具腳本

| 檔案 | 用途 | 使用頻率 |
|------|------|----------|
| `tools/story-status.cjs` | 狀態查詢 | 高 |
| `tools/poc/process-html-poc.cjs` | POC 處理 | 高 |
| `tools/plan/plan-validator.cjs` | Plan 驗證 | 中 |
| `tools/generate-context.cjs` | 跨 IDE | 低 |
| `tools/draft-parser.cjs` | Enhanced Draft 解析 ⭐ v3.5 | 高 |
| `tools/blueprint-runner.cjs` | 藍圖執行器 ⭐ v3.5 | 高 |
| `tools/blueprint-architect.cjs` | 藍圖架構師 SYSTEM_PROMPT ⭐ v3.5 | 中 |
| `tools/blueprint-visualizer.cjs` | 藍圖視覺化 ⭐ v3.5 | 中 |
| `tools/blueprint-studio.html` | 互動式藍圖工作室 ⭐ v3.5 | 低 |

### 9.4 技能插件

| 目錄 | 用途 | 狀態 |
|------|------|------|
| `skills/ralph-loop/` | 自動執行 | ✅ 穩定 |
| `skills/blueprint-architect/` | 藍圖架構師 (5 輪對話) ⭐ v3.5 | ✅ 穩定 |
| `skills/code-reviewer/` | 程式碼審查 | 🧪 實驗性 |
| `skills/frontend-design/` | 設計檢查 | ✅ 穩定 |

### 9.5 文件

| 檔案 | 用途 |
|------|------|
| `README.md` | 快速入門 |
| `GUIDE.md` | 完整指南 |
| `MASTER_PLAN.md` | 本文件 (架構總覽) |
| `docs/FUNCTION_SLICING_GUIDE.md` | Function Slicing 說明 |
| `docs/BLUEMOUSE_GUIDE.md` | BlueMouse 整合 |
| `docs/BLUEPRINT_FORMAT_SPEC.md` | Enhanced Draft 格式規格書 ⭐ v3.5 |

### 9.6 模板與範例

| 檔案 | 用途 |
|------|------|
| `templates/enhanced-draft-golden.template.md` | Enhanced Draft 黃金模板 ⭐ v3.5 |
| `templates/examples/enhanced-draft-ecotrack.example.md` | EcoTrack 完整範例 ⭐ v3.5 |
| `templates/examples/poc/` | POC 黃金範例 |
| `templates/examples/spec/` | Spec 黃金範例 |

---

## 10. 待辦與規劃

### 10.1 已完成 ✅

- [x] 四階段工作流程 (POC/PLAN/BUILD/SCAN)
- [x] GEMS 標籤系統 v2.4
- [x] @GEMS-UI-BIND 標籤 (Vanilla JS 專用)
- [x] Semantic Contract Layer (contract.json/CONTRACT.md)
- [x] 錯誤恢復系統 v2.0 (策略漂移、染色分析、增量驗證、回溯路由) ⭐ v3.4
- [x] State Manager v3
- [x] Ralph Loop v3 (含 `--new`, `--force-start`)
- [x] BlueMouse 整合
- [x] Function Slicing (掃描產出行號)
- [x] 跨 IDE 支援 (CLAUDE.md, MCP, Context Generator)
- [x] POC Step 1 驗證修復 (支援 `## 一句話目標` 和 `**POC Level**:` 格式)
- [x] Phase 7 UI Bind 驗證 (非 React/Vue 專案)
- [x] M level 加入 Phase 7 (輕量整合檢查)
- [x] SDID 格式規格書 (`docs/BLUEPRINT_FORMAT_SPEC.md`) ⭐ v3.5
- [x] Blueprint Architect Skill (5 輪對話引導產出 Enhanced Draft) ⭐ v3.5
- [x] Enhanced Draft 解析器 (`tools/draft-parser.cjs`，零依賴) ⭐ v3.5
- [x] Blueprint Runner v2 (`tools/blueprint-runner.cjs`，使用 draft-parser) ⭐ v3.5
- [x] Blueprint Visualizer (`tools/blueprint-visualizer.cjs`，MD→HTML) ⭐ v3.5
- [x] Blueprint Studio (`tools/blueprint-studio.html`，瀏覽器端互動工具) ⭐ v3.5
- [x] Enhanced Draft 黃金模板 + EcoTrack 範例 ⭐ v3.5
- [x] 完整閉環：Blueprint Architect → POC → PLAN → BUILD → SCAN → next iter ⭐ v3.5

### 10.2 保留功能 (未整合到主流程)

- [ ] Function Slicing 自動使用 (目前只產出，AI 不會自動用)

### 10.3 SDID 藍圖模式 ✅ (v3.5 完成)

- [x] SDID 格式規格書 (`docs/BLUEPRINT_FORMAT_SPEC.md`)
- [x] Blueprint Architect Skill (5 輪對話，`skills/blueprint-architect/`)
- [x] Blueprint Studio (`tools/blueprint-studio.html`，瀏覽器端)
- [x] Blueprint Runner v2 (`tools/blueprint-runner.cjs`，使用 draft-parser)
- [x] Enhanced Draft 解析器 (`tools/draft-parser.cjs`，零依賴，取代 mmap-parser)
- [x] Blueprint Visualizer (`tools/blueprint-visualizer.cjs`)
- [x] 黃金模板 + EcoTrack 範例
- [ ] Multi-Agent 並行開發支援 (moved to 10.4)

### 10.4 未來規劃

- [ ] Multi-Agent 並行開發支援
- [ ] GitHub 發布 (整理 README)
- [ ] 更多 POC 範例
- [ ] 多語言支援 (Python, Go)
- [ ] Web Dashboard

---

## 附錄

### A. 版本歷史

| 版本 | 日期 | 變更 |
|------|------|------|
| 3.5 | 2026-02-09 | 🎯 閉環完成：Blueprint Architect Skill (5 輪對話)、draft-parser.cjs (零依賴解析器，取代 mmap-parser)、blueprint-runner.cjs v2、blueprint-visualizer.cjs、blueprint-studio.html (瀏覽器端互動工具)、Enhanced Draft 黃金模板 + EcoTrack 範例。完整閉環：Blueprint Architect → POC → PLAN → BUILD → SCAN → next iter |
| 3.4 | 2026-02-06 | 錯誤恢復系統 v2.0：策略漂移 (retry-strategy)、染色分析 (taint-analyzer)、增量驗證 (incremental-validator)、回溯路由 (backtrack-router)，整合到 log-output.cjs |
| 3.3 | 2026-02-05 | @GEMS-UI-BIND 標籤、Semantic Contract Layer (contract.json/CONTRACT.md)、Phase 7 UI Bind 驗證、M level 加入 Phase 7、gems-tagging-complete-guide v2.4 |
| 3.2 | 2026-02-04 | POC Step 1 驗證修復、Ralph Loop 增強 (`--new`, `--force-start`)、SKILL.md 符合 skill-creator 規範 |
| 3.1 | 2026-02-02 | 更新目錄結構、清理未使用檔案 |
| 3.0 | 2026-01-22 | 獨立化、BUILD 順序變更 |
| 2.2 | 2026-01-15 | 防膨脹機制、@GEMS-VERIFIED |
| 2.1 | 2026-01-10 | 寬鬆標籤格式 |

### B. 相關文件

- `docs/guides/GEMS_TAG_SYSTEM_v2.md` - 標籤系統完整說明
- `docs/guides/gems-tagging-complete-guide.md` - 標籤使用指南
- `docs/FUNCTION_SLICING_GUIDE.md` - Function Slicing 說明
- `docs/BLUEPRINT_FORMAT_SPEC.md` - Enhanced Draft 格式規格書 ⭐ v3.5
- `skills/ralph-loop/SKILL.md` - Ralph Loop 說明
- `skills/blueprint-architect/SKILL.md` - Blueprint Architect 說明 ⭐ v3.5

---

*Generated by Task-Pipe Framework | 2026-02-09*
*Version 3.5*
