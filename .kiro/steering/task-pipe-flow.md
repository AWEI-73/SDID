---
inclusion: always
---

# SDID Flow v7.0 - AI 協作開發框架

**核心理念**: 腳本 print → AI 讀取 → AI 執行 → 重複直到 @PASS

## 🎯 統一入口：SDID Skill

使用者提到 SDID、Blueprint、藍圖、POC、PLAN、BUILD、SCAN、開發、繼續、新專案時，
**優先使用 `.agent/skills/sdid/` skill**。

## 🔄 主流程（唯一路線）

```
主流程:
  Draft → draft-gate → CYNEFIN-CHECK → [needsTest:true → TDD Contract Subagent → Design Reviewer]
       → Contract → contract-gate → spec-to-plan → BUILD Phase 1-4 → SCAN → VERIFY
    ↑
  可選前置（需求模糊時才進）:
  Blueprint 5輪對話 → blueprint.md → blueprint-gate → [自動銜接回 Draft 這步]
```

> ⚠️ Blueprint 不是獨立路線，是主流程的可選入口。
> task-pipe/runner.cjs 是 BUILD 執行引擎，sdid-tools 是 gate 工具，兩者都服務同一條主流程。
> 沒有「Task-Pipe 路線」vs「Blueprint 路線」的分流。

舊的 sdid-loop、blueprint-loop、blueprint-architect skill 已 deprecated，不要使用。

## 📋 判斷任務類型

| 類型 | 關鍵字 |
|------|--------|
| Blueprint（可選前置） | 藍圖、blueprint、需求模糊 |
| Draft | draft、gate、需求明確 |
| Contract | contract、cynefin |
| BUILD | 開發、build、coding、實作、測試、修正 |
| SCAN | 掃描、scan、更新規格 |

## 🚀 主流程指令參考

```bash
# 1. Blueprint Gate（可選，有 blueprint.md 時）
node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=.gems/design/blueprint.md --target=<project>

# 2. Draft Gate
node sdid-tools/blueprint/v5/draft-gate.cjs --draft=.gems/design/draft_iter-N.md --target=<project>

# 3. CYNEFIN-CHECK（非 Foundation iter 強制，draft-gate @PASS 後自動提示）
node sdid-tools/cynefin-log-writer.cjs --report-file=<project>/.gems/iterations/iter-N/cynefin-report.json --target=<project> --iter=N

# 4. flow-review skill（非 Foundation iter 強制，CYNEFIN @PASS 後觸發）
# 觸發詞: 「REVIEW FLOW」，輸入: draft_iter-N.md 的動作清單
# 輸出: 標記過的 FLOW + @GEMS-WHY，貼回 contract.ts

# 5. TDD Contract Subagent（needsTest:true 的 action 才執行）
# 參考: .agent/skills/sdid/references/tdd-contract-prompt.md
# 產出: 測試檔（RED 狀態）+ contract_iter-N.ts 的 @GEMS-TDD 路徑

# 6. Contract Gate
node sdid-tools/blueprint/v5/contract-gate.cjs --contract=.gems/iterations/iter-N/contract_iter-N.ts --target=<project> --iter=N

# 7. Contract → Plan（機械轉換）
node task-pipe/tools/spec-to-plan.cjs --target=<project> --iteration=iter-N

# 8. BUILD Phase 1-4
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y --target=<project>

# 9. SCAN
node task-pipe/runner.cjs --phase=SCAN --target=<project>

# 10. VERIFY
node sdid-tools/blueprint/verify.cjs --draft=.gems/design/draft_iter-N.md --target=<project> --iter=N
```

> ⚠️ Foundation iter（模組名 = Foundation）跳過步驟 3-5，直接從 draft-gate → contract-gate。
> 非 Foundation iter 步驟 3-5 缺一不可，draft-gate 的 NEXT 已強制指向 cynefin-log-writer。

## 📚 BUILD 階段 (Phase 1-4，v6)

### Phase 1: 骨架映射層
```bash
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y --target=.
```
- 讀 implementation_plan + contract_iter-N.ts
- 產出骨架 + GEMS 標籤全覆蓋（P0-P3）

### Phase 2: TDD 驗收層 ⭐ (v7.0)
```bash
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y --target=.
```
- 讀 contract_iter-N.ts 找 `@GEMS-TDD` 標籤
- 有 `@GEMS-TDD` → vitest --run（測試在 contract 階段就寫好，Phase 1 是 RED，Phase 2 修實作讓測試 GREEN）
- 無 `@GEMS-TDD`（DB/UI 層）→ tsc --noEmit（只驗型別）
- 不能動測試檔（測試是規格）
- 舊 @GEMS-AC-* 標籤已 deprecated，contract-gate 會輸出 @GUIDED 提示

### Phase 3: 整合層
```bash
node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y --target=.
```
- 路由整合、barrel export、模組間整合驗證
- Level S 跳過此 Phase

### Phase 4: 標籤品質+Fillback層
```bash
node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y --target=.
```
- GEMS 標籤品質複查（P0-P3 全覆蓋）
- 產出 `Fillback_Story-X.Y.md` + `iteration_suggestions_Story-X.Y.json`

## 📚 SCAN 階段

```bash
node task-pipe/runner.cjs --phase=SCAN --target=.
```
- 全專案掃描
- 驗證標籤 + 規格一致性
- 產出: 掃描報告

## 🔴 通用軍規

1. **禁止腦補**: 模糊需求必須先 `[NEEDS CLARIFICATION]`
2. **小跑修正**: SEARCH → 修正 → 重試，最多 3 次
3. **不跳步**: BUILD Phase 1-4 不能跳
4. **Context 管理**: 一個 Agent 一個 Item
5. **驗證優先**: 每個階段都有 Checkpoint
6. **獨立可測性**: 每個 Story 必須能被單獨驗證

## 🤖 AI 行為約束 (v2.5 新增)

收到腳本輸出時，AI 必須遵守以下行為規則：

1. **收到 @TASK 區塊時**：直接根據 ACTION + FILE + EXPECTED 執行修復，禁止回讀架構文件或 plan 文件來「理解全貌」
2. **收到 @NEXT_COMMAND 時**：修復完成後立即執行該命令，不要自行組裝命令
3. **收到 @REMINDER 時**：這是關鍵指令的重複確認，確保沒有遺漏任何 TASK
4. **沒有 @TASK 區塊時**：才允許讀取 plan 文件或架構文件來理解需求
5. **收到 @FORBIDDEN 時**：嚴格遵守禁止事項，不得以任何理由違反

**核心原則**：腳本已完成所有分析，AI 不需要重新分析，只需執行。

## ⚡ Quick Mode 中斷處理 (v2.7 新增)

AI 正在跑 sdid-loop 流程中，使用者插入不相關請求時：
1. 先完成當前 phase 修復循環再處理
2. 使用者堅持 → 暫停流程，提醒「BUILD Phase N 進行中，處理完你的請求後我會繼續」
3. 處理完後說「sdid 繼續」→ loop.cjs 讀 state → @RESUME → 從斷點接

## 🚫 編碼安全規則 (v2.3 新增)

**禁止使用 PowerShell 進行檔案批量操作**，會導致編碼災難：

```powershell
# ❌ 禁止 - 會破壞 UTF-8 編碼
Get-Content file.ts | ForEach-Object { $_ -replace 'old', 'new' } | Set-Content file.ts
(Get-Content file.ts) -replace 'old', 'new' | Out-File file.ts

# ✅ 正確 - 使用 Node.js 腳本
node task-pipe/tools/safe-replace.cjs <file> <content>
```

**BUILD Phase 2 會自動檢查編碼**：
- 偵測 UTF-8 BOM
- 偵測亂碼 (Mojibake)
- 偵測無效控制字元
- 編碼問題 = BLOCKER，必須先修復

## 🎨 契約設計：@GEMS-CONTRACT

`@GEMS-CONTRACT` 必須包含 DB 型別註解：

```typescript
// @GEMS-CONTRACT: EntityName
// @GEMS-TABLE: tbl_table_name
interface EntityName {
  id: string;           // UUID, PK
  fieldName: string;    // VARCHAR(100), NOT NULL
  status: EntityStatus; // ENUM('DRAFT','ACTIVE')
}
```

BUILD 時 AI 根據這些註解自行推導 Schema 和 API。

## 🔒 @CONTRACT-LOCK：契約封版標頭

Gate 通過後，在 `contract_iter-N.ts` **最頂端**寫入封版標頭（Layer 2 保護）：

```typescript
// @CONTRACT-LOCK: 2025-01-15 | Gate: iter-1
// @SPEC-CHANGES: (none)
//
// ─── 以下契約已通過 Gate，修改需加 [SPEC-FIX] 標記 ──────────────────────────
```

**規則**：
- Gate 通過後立即加頭，代表「此版本契約已定案」
- 若後續需修改 `@GEMS-TDD` 測試規格：在測試檔上方加 `// [SPEC-FIX] YYYY-MM-DD: <原因>`，並同步更新 contract.ts 的對應 @GEMS-TDD 路徑（若有異動）
- `@SPEC-CHANGES` 欄位記錄本次 Gate 相比前版的規格異動（無則填 `(none)`）

## 🏷️ GEMS 標籤 (v5.0)

```typescript
/**
 * GEMS: functionName | P[0-3] | (args)→Result | Story-X.X | 描述
 * GEMS-FLOW: Step1→Step2→Step3
 * GEMS-DEPS: [Type.Name (說明)], [Type.Name (說明)]
 * GEMS-DEPS-RISK: MEDIUM | HIGH
 */
// [STEP] Step1 (P0/P1 強制，P2/P3 可選)
// [STEP] Step2
// [STEP] Step3
```

> **v5.0 變更**：移除 `✓✓` 狀態欄（零資訊量）；移除 `GEMS-TEST` / `GEMS-TEST-FILE`（測試策略改為機械推導）；`GEMS-DEPS-RISK` 缺席 = LOW 已評估（不標 LOW）。
> **v7.0 變更**：移除 `// AC-X.Y` 行（AC 機制已 deprecated，改用 contract 層 `@GEMS-TDD` 標籤）。

## 🚨 錯誤處理 (v2.4 策略漂移)

### 三層策略漂移 (Strategy Drift)

| Level | 重試次數 | 策略名稱 | 行動 |
|-------|---------|---------|------|
| 1 | 1-3 次 | TACTICAL_FIX | 局部修補，在原檔案修復 |
| 2 | 4-6 次 | STRATEGY_SHIFT | 換個方式實作，考慮重構 |
| 3 | 7+ 次 | PLAN_ROLLBACK | 質疑架構，回退 PLAN 階段 |

### 優先級重試上限

| Priority | 最大重試 | 升級門檻 |
|----------|---------|---------|
| P0 | 10 次 | 第 4 次升級 |
| P1 | 8 次 | 第 3 次升級 |
| P2 | 5 次 | 第 2 次升級 |
| P3 | 3 次 | 第 2 次升級 |

## 📁 目錄結構（v6）

```
專案根目錄/
├── .gems/
│   ├── design/                     # 設計文件集中（v6）
│   │   ├── blueprint.md            # 可選，全局設計索引
│   │   └── draft_iter-N.md         # Per-iter Draft（功能需求 + TDD 測試需求）
│   ├── logs/                       # MICRO-FIX 全局 log
│   └── iterations/
│       └── iter-N/
│           ├── .state.json
│           ├── contract_iter-N.ts  # Contract（iter 核心 artifact）
│           ├── poc-fix/            # POC-FIX 工作區（按需建立）
│           ├── plan/
│           │   └── implementation_plan_Story-X.Y.md
│           ├── build/
│           │   ├── Fillback_Story-X.Y.md
│           │   └── iteration_suggestions_Story-X.Y.json
│           └── logs/
└── src/
    └── modules/
```

## Log 命名規則

```
blueprint-gate-{pass|error}-{ts}.log
draft-gate-{pass|error}-{ts}.log
contract-gate-{pass|error}-{ts}.log
cynefin-check-{pass|fail}-{ts}.log
pocfix-active-{ts}.log
pocfix-pass-{ts}.log
build-phase-{N}-Story-{X.Y}-{status}-{ts}.log
scan-scan-{pass|error}-{ts}.log
gate-verify-{pass|error}-{ts}.log
# MICRO-FIX（全局，不屬於 iter）
microfix-{pass|error}-{ts}.log  → .gems/logs/
```

## 🛠️ 輔助工具

```bash
# 狀態查看
node sdid-tools/state-guide.cjs --project=<project>

# 專案狀態
node task-pipe/tools/project-status.cjs --target=<project>

# GEMS 標籤壓縮（可選）
node task-pipe/tools/shrink-tags.cjs --target=<project> --dry-run

# 監控
node sdid-monitor/server.cjs   # http://localhost:3737
```

## 📖 參考文件

- `ARCHITECTURE.md` - 系統架構（完整版）
- `.agent/skills/sdid/SKILL.md` - AI skill hub（路由判斷）
- `task-pipe/README.md` - task-pipe 快速開始
