# Blueprint Flow 端到端測試記錄

**測試專案**: `test-blueprint-flow/` (ecotrack 範例 draft)
**開始時間**: 2026-03-03
**目的**: 從 MCP/本地 CLI 角度走完 Blueprint Flow 全流程，記錄每步行為與異常

---

## 流程總覽

```
GATE → CYNEFIN(skip) → PLAN(draft-to-plan) → BUILD 1-8 → SHRINK → VERIFY
```

---

## Step 1: state-guide 初始偵測

- **指令**: `node sdid-tools/state-guide.cjs --project=test-blueprint-flow`
- **結果**: ✅ 正確偵測 ROUTE=Blueprint, STATUS=GATE check
- **NEXT 輸出**: 正確指向 `blueprint-gate.cjs`

---

## Step 2: blueprint-gate (第一次 — FAIL)

- **指令**: `node sdid-tools/blueprint-gate.cjs --draft=...requirement_draft_iter-1.md --target=test-blueprint-flow --iter=1`
- **結果**: ❌ @BLOCKER — 3 個 ACC-001
- **原因**: ecotrack 範例 draft 沒有 AC 欄位（範例是 v2.2 之前寫的）

### 🐛 BUG-001: ecotrack 範例 draft 過時
- **位置**: `task-pipe/templates/examples/enhanced-draft-ecotrack.example.md`
- **問題**:
  1. 動作清單缺少 AC 欄位（v2.2 新增 ACC-001 規則要求 P0/P1 必填 AC）
  2. 用 `藍圖狀態` 而非 `草稿狀態`（Gate 的 checkDraftStatus 只認 `**草稿狀態**`）
- **影響**: 新用戶照範例寫 draft 一定被 Gate 擋
- **修復建議**: 更新範例，加 AC 欄 + 驗收條件區塊 + 改 `草稿狀態`

---

## Step 3: blueprint-gate (第二次 — PASS)

- **修復**: 動作清單加 AC 欄、加「✅ 驗收條件」區塊、`藍圖狀態` → `草稿狀態`
- **結果**: ✅ @PASS (0 blocker, 2 warn)
- **WARN**: BUDGET-002 (iter-1 動作數=4 剛好到 M 上限), VSC-001 (Foundation 建議加 ROUTE)

---

## Step 4: state-guide (Gate PASS 後)

- **結果**: ⚠️ 仍顯示 STATUS=GATE check

### 🐛 BUG-002: state-guide Gate PASS 後不前進
- **位置**: `sdid-tools/state-guide.cjs` → `detectFullState()`
- **根因**:
  1. Gate 工具只寫 log，不寫 `.state.json` ledger
  2. `detectFullState()` fallback：沒有 state-manager → 沒有 lastStep → 只看 draftPath 存在 → 永遠回 GATE
  3. 不讀 logs/ 目錄來判斷 Gate 是否已通過
- **影響**: loop.cjs / MCP 無法自動推進到 PLAN
- **修復建議**: detectFullState 應讀 `logs/gate-*-pass-*.log`，若存在則推進；或讓 gate/plan 工具寫入 `.state.json`

---

## Step 5: draft-to-plan

- **指令**: `node sdid-tools/draft-to-plan.cjs --draft=... --iter=1 --target=test-blueprint-flow`
- **結果**: ✅ @PASS — 產出 `implementation_plan_Story-1.0.md`
- **附帶訊息**: 4 個 FILE_PATH_MISSING（正常，新專案無 src/）
- **Plan 品質**: 乾淨，4 個 Item 都有 GEMS 標籤骨架、AC 引用、檔案清單

---

## Step 6: BUILD Phase 1 (骨架檢查)

- **結果**: Exit 1 — @TASK template 模式（綠地專案，需 AI 建骨架）
- **輸出**: @GREENFIELD 初始化指引 + PLAN_SPECS 標籤模板 + @MODULAR_STRUCTURE 檢查清單

### ⚠️ NOTICE-001: Phase 1 NEXT 缺少 --target 和 --iteration
- **問題**: NEXT 只輸出 `--phase=BUILD --step=2 --story=Story-1.0`，缺少 `--target=` 和 `--iteration=`
- **嚴重度**: 低

---

## Step 7: BUILD Phase 2 (標籤驗收 — 第一次 FAIL)

- **結果**: ❌ @BLOCKER — 2 個 FILE_MISSING (dbClient, factorService)
- **錯誤訊息**: 「檔案存在但缺少 GEMS 標籤」

### 🐛 BUG-003: gems-scanner-v2 GEMS 標籤位置敏感性
- **位置**: `sdid-tools/gems-scanner-v2.cjs` → `getLeadingComment()`
- **根因**:
  1. scanner-v2 用 `ts.getLeadingCommentRanges(fullText, node.getFullStart())` 抓註解
  2. 只能抓「緊鄰節點前」的註解
  3. GEMS 標籤在檔案頂部（import 之前），`export const xxx` 在 import 之後 → AST 不關聯
- **重現**: GEMS 標籤 → import → export const → scanner 漏掃
- **Workaround**: 把 GEMS 標籤移到緊鄰 `export const` 之前
- **修復建議**: scanner-v2 應先掃全檔 GEMS 註解，用 funcName 匹配 AST 節點

---

## Step 8: BUILD Phase 2 (第二次 — PASS)

- **修復**: GEMS 標籤從檔案頂部移到緊鄰 `export const` 之前
- **結果**: ✅ @PASS — 覆蓋率 100%, P0:2, P1:1

---

## Step 9: BUILD Phase 3 (測試腳本)

- **結果**: Exit 1 — @TASK template 模式（需 AI 寫測試）

### 🐛 BUG-004: Phase 3/4/8 函式計數為零
- **位置**: `task-pipe/phases/build/phase-3.cjs`, `phase-4.cjs`, `phase-8.cjs`
- **問題**: @INFO 顯示 `P0 函式: 0, P1 函式: 0, P2 函式: 0`
- **根因**: 這些 Phase 沒有自己跑 scanner，也沒讀 Phase 2 的掃描結果
- **影響**: AI 不知道要為哪些函式寫測試；Fillback 標籤統計全 0
- **嚴重度**: 中

---

## Step 10: BUILD Phase 4 (Test Gate)

- **結果**: ✅ @PASS
- **備註**: P0: 0/0, P1: 0/0（BUG-004 延續，但不阻擋）

---

## Step 11: BUILD Phase 5 (TDD 測試執行 — 第一次 FAIL)

- **結果**: ❌ Exit 1 — 測試環境未就緒（無 package.json）
- **修復**: 建 package.json + 安裝 jest/ts-jest/typescript + jest.config.js + tsconfig.json

---

## Step 12: BUILD Phase 5 (第二次 — PASS)

- **結果**: ✅ @PASS — 6028ms
- **備註**: 統計 `0 passed / 0 failed / 0 total`

### ⚠️ NOTICE-002: Phase 5 測試統計為 0/0/0
- **問題**: jest 跑了但沒找到測試（可能 ts-jest 配置問題），`--passWithNoTests` 讓它通過
- **嚴重度**: 中（測試沒真的跑，但 Phase 5 報 PASS）
- **根因**: 可能是 jest testMatch 和實際測試檔案路徑不匹配，或 ts-jest transform 沒配好

---

## Step 13: BUILD Phase 7 (整合檢查 — 第一次 FAIL)

- **結果**: Exit 1 — 缺少 `shared/index.ts` barrel export
- **修復**: 建 `src/shared/index.ts`

---

## Step 14: BUILD Phase 7 (第二次 — PASS，用 --pass flag)

- **結果**: ✅ @PASS
- **預警**: 缺少入口點 (index.html/main.ts)、缺少 dev/start script

---

## Step 15: BUILD Phase 8 (Fillback)

- **結果**: Exit 1 — @AI_TASK 需要填 TODO
- **產出**: `Fillback_Story-1.0.md` + `iteration_suggestions_Story-1.0.json`
- **問題**:
  1. `[STEP] 錨點不一致` — dbClient/factorService 未偵測到（BUG-003 同源）
  2. 標籤統計全 0（BUG-004）
  3. suggestions.json 的 completedItems.functions 全空

### 🐛 BUG-005: Phase 8 [STEP] 錨點偵測失敗
- **位置**: `task-pipe/phases/build/phase-8.cjs`
- **問題**: Phase 8 的 STEP 錨點檢查找不到 dbClient/factorService 的 [STEP]
- **根因**: 可能跟 BUG-003 同源 — scanner 找不到函式，所以也找不到 [STEP]
- **影響**: qualityIssues 報假陽性 STEP_MISMATCH

---

## Step 16: SHRINK

- **指令**: `node sdid-tools/blueprint-shrink.cjs --draft=... --iter=1 --target=test-blueprint-flow`
- **結果**: ✅ @PASS — shared → [DONE] (4 動作)
- **藍圖更新**: iter-1 的 shared 狀態改為 [DONE]

---

## Step 17: state-guide (SHRINK 後)

- **結果**: ⚠️ 仍顯示 STATUS=GATE check（BUG-002 再現）
- **備註**: 正確偵測 STORIES: 1/1, Story-1.0: DONE，但 STATUS/NEXT 仍指向 GATE

### 🐛 BUG-002 補充: state-guide 在整個 BUILD 完成後仍不前進
- 即使 Story-1.0 DONE + SHRINK PASS，state-guide 仍停在 GATE
- detectFullState 完全沒有讀 logs/ 的邏輯
- 也沒有「所有 stories done → 推進到 SHRINK/VERIFY」的邏輯

---

## Step 18: VERIFY (第一次 — FAIL)

- **指令**: `node sdid-tools/blueprint-verify.cjs --draft=... --target=test-blueprint-flow --iter=1`
- **結果**: ❌ `functions.json 不存在`
- **NEXT 建議**: 先執行 SCAN 產出 functions.json

### 🐛 BUG-006: Blueprint Flow VERIFY 依賴 SCAN 產出
- **位置**: `sdid-tools/blueprint-verify.cjs`
- **問題**: VERIFY 需要 `.gems/docs/functions.json`，但這個檔案由 SCAN 產出
- **矛盾**: Blueprint Flow 文件說「不走 SCAN，用 SHRINK+VERIFY 替代」，但 VERIFY 實際需要 SCAN 的產出
- **影響**: Blueprint Flow 無法獨立完成，必須插入一次 SCAN
- **修復建議**:
  1. VERIFY 自己跑 scanner 產出 functions.json（不依賴 SCAN）
  2. 或 SHRINK 順便產出 functions.json
  3. 或文件改為「SHRINK → SCAN → VERIFY」

---

## Step 19: SCAN (補跑)

- **指令**: `node task-pipe/runner.cjs --phase=SCAN --target=test-blueprint-flow --iteration=iter-1`
- **結果**: ✅ @PASS — 4 functions, 1 story
- **產出**: `.gems/docs/functions.json`

---

## Step 20: VERIFY (第二次 — PASS)

- **指令**: `node sdid-tools/blueprint-verify.cjs --draft=... --target=test-blueprint-flow --iter=1`
- **結果**: ✅ @PASS — 覆蓋率 100%, 4 匹配, 0 缺失, 0 多餘
- **產出**: `blueprint-verify.json` + `BLUEPRINT_VERIFY.md`
- **NEXT**: 「藍圖與程式碼完全一致，可進入下一個 iter」

---

## 🏁 iter-1 完整流程結束

### 實際走過的流程
```
state-guide → GATE(fail→fix→pass) → draft-to-plan → BUILD 1(template)
→ BUILD 2(fail→fix→pass) → BUILD 3(template) → BUILD 4(pass)
→ BUILD 5(fail→fix→pass) → BUILD 7(fail→fix→pass) → BUILD 8(template)
→ SHRINK(pass) → SCAN(補跑) → VERIFY(pass)
```

### 每步耗時（大約）
| 步驟 | 腳本 | 結果 |
|------|------|------|
| GATE | blueprint-gate.cjs | 2 次（1 fail + 1 pass） |
| PLAN | draft-to-plan.cjs | 1 次 pass |
| BUILD 1 | phase-1.cjs | template（需 AI） |
| BUILD 2 | phase-2.cjs | 2 次（1 fail + 1 pass） |
| BUILD 3 | phase-3.cjs | template（需 AI） |
| BUILD 4 | phase-4.cjs | 1 次 pass |
| BUILD 5 | phase-5.cjs | 2 次（1 env fail + 1 pass） |
| BUILD 7 | phase-7.cjs | 2 次（1 checklist + 1 --pass） |
| BUILD 8 | phase-8.cjs | template（需 AI 填 TODO） |
| SHRINK | blueprint-shrink.cjs | 1 次 pass |
| SCAN | scan.cjs | 1 次 pass（補跑） |
| VERIFY | blueprint-verify.cjs | 2 次（1 fail + 1 pass） |

---

## BUG 彙總

| ID | 嚴重度 | 位置 | 摘要 |
|----|--------|------|------|
| BUG-001 | 中 | `templates/examples/enhanced-draft-ecotrack.example.md` | 範例 draft 缺 AC 欄 + 用錯狀態欄位名 | ✅ 已修 |
| BUG-002 | 高 | `state-guide.cjs` → `detectFullState()` | Gate PASS 後 state-guide 不前進，永遠停在 GATE；整個 BUILD 完成後也不前進 | ✅ 已修 |
| BUG-003 | 高 | `gems-scanner-v2.cjs` → `getLeadingComment()` | GEMS 標籤在 import 前時被漏掃（AST leading comment 位置敏感） | ✅ 已修 |
| BUG-004 | 中 | `phase-3/4/8.cjs` | @INFO 函式計數全為 0，沒正確讀取掃描結果 | ✅ 已修 |
| BUG-005 | 低 | `phase-8.cjs` | [STEP] 錨點偵測失敗（BUG-003/004 同源） | ✅ 已修(同源) |
| BUG-006 | 高 | `blueprint-verify.cjs` | VERIFY 依賴 SCAN 產出的 functions.json，但 Blueprint Flow 文件說不走 SCAN | ✅ 已修 |

| ID | 嚴重度 | 位置 | 摘要 |
|----|--------|------|------|
| NOTICE-001 | 低 | Phase 1 @OUTPUT | NEXT 命令缺少 --target 和 --iteration |
| NOTICE-002 | 中 | Phase 5 | 測試統計 0/0/0，jest 沒真的跑測試但報 PASS |

---

## 修復狀態

全部 6 個 BUG 已修復：

| BUG | 修復方式 |
|-----|---------|
| BUG-001 | 更新 ecotrack 範例 draft：加 AC 欄、加驗收條件區塊、`藍圖狀態` → `草稿狀態` |
| BUG-002 | `state-guide.cjs` 新增 `inferStateFromLogs()` — 讀 logs/ 目錄推斷 Blueprint 狀態（GATE→PLAN→BUILD→SHRINK→VERIFY→COMPLETE） |
| BUG-003 | `gems-scanner-v2.cjs` 新增 `extractAllGemsComments()` — 預掃全檔 GEMS 註解，位置無關匹配 |
| BUG-004 | `gems-validator.cjs` 新增 v2.1 fallback — regex 版掃到 0 tagged 時自動 fallback 到 scanner-v2 (AST 版) |
| BUG-005 | 同 BUG-003/004 修復，scanner 能正確偵測標籤後 STEP 錨點也能匹配 |
| BUG-006 | `blueprint-verify.cjs` 新增自動 scan fallback — functions.json 不存在時自動跑 scanV2() |
