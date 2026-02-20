# 🗄️ Archive - 未被主流程引用的檔案

> 產生日期: 2026-02-10
> 分析方法: 從所有入口點 (runner.cjs, phases/*, mcp/, skills/ralph-loop) 遞迴追蹤每一個 require()，含 dynamic require 和 try/catch fallback

## ⚠️ 驗證方式

每個檔案都經過以下確認：
1. 全域 `require()` 搜尋 (含 path.join 動態拼接)
2. 確認 try/catch fallback 是否會觸發
3. 確認 `require.main === module` 的 CLI 自執行不算被引用
4. 確認不存在的檔案引用 (如 `lib/gems-scanner.cjs` 不存在但被 phase-2/8 引用 → 走 fallback)

---

## 📁 分類

### `standalone-tools/` — 獨立 CLI 工具
這些可以手動 `node xxx.cjs` 執行，但不被 runner 或任何 phase require。
移除不影響 task pipe 主流程。

| 檔案 | 說明 | 備註 |
|------|------|------|
| `blueprint-runner.cjs` | Blueprint 執行器 | 引用 draft-parser.cjs |
| `blueprint-visualizer.cjs` | MD/JSON → HTML 視覺化 | 引用 draft-parser.cjs |
| `blueprint-kickstart.cjs` | Blueprint 快速啟動 | 引用 blueprint-architect.cjs |
| `blueprint-architect.cjs` | 藍圖架構師 | 被 kickstart 引用，但 kickstart 本身不在主流程 |
| `blueprint-studio.html` | 瀏覽器端互動式藍圖工作室 | 純 HTML |
| `draft-parser.cjs` | Enhanced Draft 解析器 | 被 blueprint-runner/visualizer 引用 |
| `generate-context.cjs` | 產生文字貼到任何 AI | 獨立工具 |
| `safe-replace.cjs` | 批次安全替換 | 獨立工具 |
| `story-status.cjs` | Story 狀態查詢 | 引用 lib/checkpoint.cjs |
| `test-anchor-output.cjs` | 錨點輸出測試 | 測試用 |
| `stress-test-evolution.cjs` | Evolution 壓力測試 | 引用 gems-validator-lite, error-classifier |
| `poc/process-html-poc.cjs` | HTML POC 處理 | 引用 html-poc-parser, html-poc-to-spec |
| `poc/html-poc-parser.cjs` | HTML POC 解析 | 被 process-html-poc 引用 |
| `poc/html-poc-to-spec.cjs` | HTML POC → Spec 轉換 | 被 process-html-poc 引用 |
| `poc/migrate-poc-ui.cjs` | POC UI 遷移 | 獨立工具 |
| `poc/blueprint-specPOC.html` | Blueprint Spec POC HTML | 純 HTML |
| `plan/plan-validator.cjs` | Plan 驗證 | 獨立工具 |
| `plan/story-number-advisor.cjs` | Story 編號建議 | 獨立工具 |
| `plan/generate-plan-templates.cjs` | Plan 模板產生 | 獨立工具 |
| `build/scaffold-files.cjs` | Scaffold 檔案產生 | 獨立工具 |
| `build/route-fixer.cjs` | Route 修復 | 獨立工具 |
| `build/init-project.cjs` | 專案初始化 | 獨立工具 |
| `build/env-checker.cjs` | 環境檢查 | 獨立工具 |
| `scan/gems-full-scanner.cjs` | 完整 GEMS 掃描 | 獨立工具 |
| `scan/gems-scanner.cjs` | GEMS 掃描 (tools 版) | 引用外部 task-pipe 路徑，獨立工具 |
| `auto-runner/` | 自動執行器 | 含 index.cjs, GUIDE.md, install.bat, package.json |

### `broken-bluemouse/` — 斷鏈的 BlueMouse 子系統

這組模組設計上是 poc/step-1 的蘇格拉底問題 + phase-6 的安全檢查，但因為 `security-checker.cjs` 硬 require 已不存在的 `bluemouse-adapter.cjs` (v1)，導致整條鏈在 require 時就爆掉，功能從未觸發。

引用鏈：`bluemouse-adapter-v2 → security-checker → bluemouse-adapter (v1, 不存在) 💥`

| 檔案 | 說明 |
|------|------|
| `bluemouse-adapter-v2.cjs` | 統一接口 (蘇格拉底 + 安全檢查) |
| `security-checker.cjs` | 安全檢查封裝 (硬 require 不存在的 v1) |
| `socratic-generator.cjs` | 蘇格拉底問題生成 (本身沒壞，但被 v2 拖下水) |
| `knowledge_base.json` | 蘇格拉底問題知識庫 (被 socratic-generator 引用) |

如果要修復：讓 security-checker 自帶 `runBasicSecurityCheck` 實作，不再依賴 v1 adapter。

### `unused-lib/` — 未被引用的 lib 模組

| 檔案 | 說明 | 驗證細節 |
|------|------|----------|
| `lib/shared/gems-patterns.cjs` | 共用 GEMS patterns | lib/shared/ 內無任何 .cjs 引用它 |
| `lib/scan/gems-scanner.cjs` | AST 版 GEMS scanner | phases 用的是 gems-scanner-enhanced.cjs，此檔無人 require |
| `lib/auto-fixer/route-fixer.cjs` | Route 修復 | 全域搜尋無引用 |
| `lib/auto-fixer/test-scaffold.cjs` | 測試 Scaffold | 全域搜尋無引用 |
| `lib/scaffold/compliance-check.cjs` | Compliance 檢查 | scaffold/index.cjs 不引用它 |
| `lib/scaffold/demo.cjs` | Scaffold Demo | scaffold/index.cjs 不引用它 |

### `unused-skills/` — 未被主流程引用的 Skills

| 檔案 | 說明 | 驗證細節 |
|------|------|----------|
| `skills/code-reviewer/` (整個目錄) | 程式碼審查 skill | 全域搜尋無外部引用，僅內部互相引用 |
| `skills/blueprint-architect/` (整個目錄) | 藍圖架構師 skill | 僅含 SKILL.md + references/，無 .cjs 被引用 |

### `unused-templates/` — 未被程式碼 require 的模板

| 檔案 | 說明 | 驗證細節 |
|------|------|----------|
| `templates/CLAUDE.md.template` | Claude 模板 | 全域搜尋無引用 |
| `templates/integration.template.md` | 整合模板 | 全域搜尋無引用 |
| `templates/poc/counter-poc.html` | Counter POC 範例 | 全域搜尋無引用 |
| `templates/poc/health-poc.html` | Health POC 範例 | 全域搜尋無引用 |
| `templates/poc/todo-poc.html` | Todo POC 範例 | 全域搜尋無引用 |
| `templates/examples/poc/DesignFirst_POC_GOLD.html` | POC 黃金範例 | 全域搜尋無引用 |
| `templates/examples/poc/TaskManagerPOC_GOLD.html` | POC 黃金範例 | 全域搜尋無引用 |
| `templates/examples/README.md` | 範例說明 | 文件 |

### `unused-orchestrator/` — 未被引用的 Orchestrator

| 檔案 | 說明 | 驗證細節 |
|------|------|----------|
| `orchestrator/poc-demo.cjs` | POC Demo | 全域搜尋無引用 |

### `test-fixtures/` — 測試檔案

| 檔案 | 說明 |
|------|------|
| `tools/__tests__/` | 測試資料 (ecotrack-blueprint.html, test-ecotrack-draft.md, .gems/) |
| `lib/shared/__tests__/error-recovery-stress.test.cjs` | 錯誤恢復壓力測試 |

---

## 🔴 不可移動 — 容易誤判的檔案

以下檔案看起來像沒用，但實際上有被引用：

| 檔案 | 被誰引用 | 引用方式 |
|------|----------|----------|
| `lib/scan/gems-patterns.cjs` | `lib/scan/gems-validator.cjs` | `require('./gems-patterns.cjs')` 直接引用 |
| `lib/scan/gems-validator-lite.cjs` | `phases/build/phase-2.cjs`, `lib/scan/gems-scanner-enhanced.cjs` | 動態 + 直接引用 |
| `lib/shared/backtrack-router.cjs` | `lib/shared/error-handler.cjs`, `lib/shared/log-output.cjs` | try/catch 可選載入 |
| `lib/shared/retry-strategy.cjs` | `lib/shared/error-handler.cjs`, `lib/shared/log-output.cjs` | try/catch 可選載入 |
| `lib/shared/taint-analyzer.cjs` | `lib/shared/error-handler.cjs`, `lib/shared/log-output.cjs`, `lib/shared/incremental-validator.cjs` | try/catch 可選載入 + 直接引用 |
| `lib/shared/incremental-validator.cjs` | `lib/shared/error-handler.cjs`, `lib/shared/log-output.cjs` | try/catch 可選載入 |
| `lib/shared/safe-output.cjs` | `tools/auto-runner/index.cjs` | 直接引用 (但 auto-runner 本身不在主流程) |
| `lib/error-classifier.cjs` | `lib/shared/log-output.cjs` | 動態 path.resolve + require |
| `lib/stress-test-integration.cjs` | `phases/build/phase-8.cjs` | 動態 require (try/catch) |
| `lib/stress-test-runner.cjs` | `runner.cjs` | 條件 require (--stress-test 模式) |
| `lib/build/encoding-validator.cjs` | `phases/build/phase-2.cjs` | 直接 require |
| `lib/shared/src-path-resolver.cjs` | `phases/build/phase-2.cjs` | 直接 require |
| `lib/gems-scanner-gas.cjs` | `phases/build/phase-2.cjs` | 動態 path.join + require |
| `lib/security-checker.cjs` | `phases/build/phase-6.cjs` | try/catch 動態 require |
| `lib/build/code-validator.cjs` | `phases/build/phase-6.cjs` | try/catch 動態 require |
| `lib/build/executability-validator.cjs` | `phases/build/phase-8.cjs` | 動態 require |
| `lib/build/ui-bind-validator.cjs` | `phases/build/phase-7.cjs` | 直接 require |
| `tools/force-commands.cjs` | `runner.cjs` | 條件 require (--diagnose 模式) |
| `tools/quality-check/poc-quality-checker.cjs` | `phases/poc/step-4.cjs`, `phases/poc/step-5.cjs`, `phases/build/phase-1.cjs` | 直接 require |
| `tools/quality-check/content-quality-checker.cjs` | `phases/poc/step-5.cjs` | 直接 require |
| `skills/frontend-design/design-quality-checker.cjs` | `phases/poc/step-4.cjs` | 直接 require |
| `lib/auto-fixer/gems-fixer.cjs` | `phases/build/phase-2.cjs` | 動態 require |

## ⚠️ 已知的幽靈引用 (引用不存在的檔案)

| 引用者 | 引用目標 | 狀態 |
|--------|----------|------|
| `lib/security-checker.cjs` | `./bluemouse-adapter.cjs` (v1) | 檔案不存在，phase-6 用 try/catch 包住 |
| `phases/build/phase-2.cjs`, `phase-8.cjs` | `../../lib/gems-scanner.cjs` | 檔案不存在，走 fallback 到 gems-validator |
| `runner.cjs` | `./lib/shared/state-manager.cjs` (v2) | 檔案不存在，走 fallback 到 v3 |
| `lib/gems-scanner-gas.cjs` | `./gems-patterns.cjs` (lib 根目錄) | 檔案不存在，走 fallback 到內建正則 |
