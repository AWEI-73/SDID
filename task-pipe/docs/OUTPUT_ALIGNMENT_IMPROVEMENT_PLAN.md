# Task-Pipe Output Alignment & Improvement Plan v1.0

> 基於 Context Engineering 最新研究 (Anthropic, Google Research, Martin Fowler)
> 對齊 FULL_OUTPUT_REFERENCE.md 與實際 log-output.cjs 實作
> 生成日期: 2026-02-14

---

## 📊 Executive Summary

### 分析範圍
- `task-pipe/lib/shared/log-output.cjs` (1006 行) — Task-Pipe 核心輸出引擎
- `sdid-tools/lib/log-output.cjs` (458 行) — Blueprint Flow 輸出引擎
- `task-pipe/docs/FULL_OUTPUT_REFERENCE.md` (1383 行) — 輸出規格書

### 核心發現
| 維度 | 現狀評分 | 目標評分 | 說明 |
|------|---------|---------|------|
| **Log 讀取穩定性** | **3/10** | **9/10** | **AI 不穩定讀 log — 終端截斷 vs context 汙染** |
| 標記一致性 | 6/10 | 9/10 | 文件定義 vs 實作有偏差 |
| Token 效率 | 5/10 | 8/10 | 存在大量重複輸出消耗 token |
| Context 分層 | 4/10 | 8/10 | 缺乏 Anthropic 4 Pillars 架構 |
| 雙引擎對齊 | 5/10 | 9/10 | task-pipe vs sdid-tools API 不一致 |
| 結構化程度 | 7/10 | 9/10 | 基礎良好，可升級到 JSON Signal |

---

## 🔬 第一部分：現狀問題深度分析

### Issue 1: 標記定義不一致 (Marker Definition Drift)

**問題**: FULL_OUTPUT_REFERENCE.md 定義了 25+ 種標記，但實際 log-output.cjs 的輸出行為與文件不完全對齊。

| 標記 | 文件定義 | 實際實作 | 偏差 |
|------|---------|---------|------|
| `@TACTICAL_FIX` | 直接輸出 | anchorOutput 內轉為 `@ITERATION_ADVICE` | ⚠️ 語義轉換未記錄 |
| `@BLOCKER` | 直接輸出 | anchorOutput 內轉為 `@ARCHITECTURE_REVIEW` | ⚠️ 語義轉換未記錄 |
| `@NEEDS_CLARIFICATION` | 有定義 | 實作中未找到對應輸出函式 | ❌ 定義孤兒 |
| `@GEMS-VERIFIED` | 有定義 | 由 Step 腳本直接輸出，非 log-output | ⚠️ 職責不清 |
| `@GEMS-CONTRACT` | 有定義 | 由 Step 腳本直接輸出，非 log-output | ⚠️ 職責不清 |
| `@ANALYSIS` | 未定義 | log-output.cjs 有輸出邏輯 | ❌ 實作孤兒 |
| `@BACKTRACK_HINT` | 未定義 | anchorError 有條件輸出 | ❌ 實作孤兒 |
| `@LOG` | 有定義 | 代碼註解說「不再重複印出」 | ⚠️ 行為已改但文件未更新 |

**影響**: AI Agent 可能基於過時的文件定義做決策，導致解析錯誤或忽略重要信號。

---

### Issue 2: Token 效率問題 (Token Budget Waste)

**來源**: Anthropic 4 Pillars — **Compress** 原則

目前的輸出存在多處 token 浪費：

#### 2a. 雙重輸出 (Terminal + Log File)
```
anchorOutput() 的行為:
  1. console.log() → 印到終端
  2. saveLog()     → 存到 .log 檔案
  
問題: 終端輸出的內容 = Log 檔案內容 → 100% 重複
```

**Token 成本估算**:
- 平均每次錯誤輸出: ~300-500 tokens
- 同樣內容存到 log 又印到終端: 額外浪費 ~300-500 tokens
- 一個 Story 平均 3-5 次錯誤: 額外浪費 1500-2500 tokens

#### 2b. 施工紅線重複 (Prompt Repetition Overuse)
```
目前有 3 處重複施工紅線:
  1. anchorOutput() 的 [MILITARY-SPECS] 區塊 (12 行)
  2. anchorError() 的 @REPEAT-RULE (2 行)
  3. anchorErrorSpec() 的 @FORBIDDEN (3 行)
  4. emitTaskBlock() 的 @FORBIDDEN (3 行)
```

**研究對齊**: Google Research arXiv:2512.14982 確實指出重複有效，但建議**精確重複核心約束**而非泛化重複。目前的 `[MILITARY-SPECS]` 包含 12 行規則，過度膨脹。

#### 2c. 範例模板過長 (Example Bloat)
`@ERROR_SPEC` 和 `@TEMPLATE_PENDING` 會包含完整範例。當 Agent 已經通過多個 Story 後，這些範例對「有經驗的 Agent」是冗餘的。

**建議**: 引入 **Adaptive Example** 機制 — 第一次失敗給完整範例，重試時只給差異點。

---

### Issue 3: Context 分層缺失 (No Layered Context Architecture)

**來源**: Anthropic Context Engineering 的 4 Pillars: Curate, Persist, Isolate, Compress

目前的 log-output.cjs 是「扁平輸出」— 所有資訊一次性印到終端，沒有分層管理：

```
現狀 (扁平):
┌─────────────────────────┐
│ @CONTEXT                │ ← 與 @INFO, @GUIDE, @RULES 混在同一層
│ @INFO                   │
│ @GUIDE                  │
│ @RULES                  │
│ @TASK                   │
│ @TEMPLATE (全文)        │ ← 可能 100+ 行直接印出
│ @ERROR                  │
│ @OUTPUT                 │
│ [MILITARY-SPECS] (12行) │ ← 每次都重複
│ @REPEAT-RULE            │ ← 又重複
└─────────────────────────┘

理想 (分層):
┌─ Signal Layer (必印) ──────────┐
│ @PASS / @BLOCKER / @TACTICAL   │ ← 1 行 signal
│ @NEXT_COMMAND                  │ ← 1 行指令
└────────────────────────────────┘
┌─ Context Layer (JIT 擷取) ────┐
│ @TARGET_FILE: path             │ ← 精準定位
│ @MISSING: [items]              │ ← 缺什麼
│ @GATE_SPEC: {checks}          │ ← 怎麼驗證
└────────────────────────────────┘
┌─ Reference Layer (存檔) ──────┐
│ 完整 TEMPLATE → .log file     │ ← 需要時讀取
│ 完整範例 → .log file          │ ← 需要時讀取
│ 策略漂移詳情 → .log file      │ ← 需要時讀取
└────────────────────────────────┘
```

---

### Issue 4: 雙引擎 API 不對齊 (Dual Engine API Drift)

`task-pipe/lib/shared/log-output.cjs` vs `sdid-tools/lib/log-output.cjs`:

| 函式 | task-pipe | sdid-tools | 差異 |
|------|-----------|-----------|------|
| `emitTaskBlock` | ✅ 有 | ❌ 沒有 | 僅 Task-Pipe |
| `outputTemplate` | ✅ 有 | ❌ 沒有 | 僅 Task-Pipe |
| `outputStructured` | ✅ 有 | ❌ 沒有 | 僅 Task-Pipe |
| `errorClassifier` 整合 | ✅ 有 | ❌ 沒有 | 僅 Task-Pipe |
| `retryStrategy` 整合 | ✅ 有 | ❌ 沒有 | 僅 Task-Pipe |
| `taintAnalyzer` 整合 | ✅ 有 | ❌ 沒有 | 僅 Task-Pipe |
| `@REPEAT-RULE` 格式 | `🚫 禁止修改 task-pipe/` | `🚫 禁止修改 task-pipe/ 和 sdid-tools/` | ⚠️ 文字不同 |

**影響**: Blueprint Flow 在錯誤處理上比 Task-Pipe Flow 弱很多。兩條路線的 Agent 體驗不一致。

---

### Issue 5: 產出一致性問題 (Output Consistency)

#### 5a. 亦中亦英混雜
```
目前:
  @PASS | POC Step 1 | Draft 驗證通過，{N} 個功能需求已確認
  下一步: node task-pipe/runner.cjs ...
  修復後: node task-pipe/runner.cjs ...
  詳情: .gems/iterations/...
  
問題:
  - "下一步" vs "修復後" — 同義不同名 (成功用「下一步」, 錯誤用「修復後」)
  - 欄位名用中文，但標記名用英文 → AI 需要同時 parse 兩種語言
```

#### 5b. 格式雜亂
```
anchorPass:   @PASS | {phase} {step} | {summary}
outputPass:   @PASS | {summary}  ← 少了 phase/step

anchorError:  @TACTICAL_FIX (N/N) | {summary}
outputError:  @TACTICAL_FIX | {summary}  ← 少了重試計數

anchorErrorSpec: @ERROR_SPEC (N/N)  ← 有重試計數
emitTaskBlock:   @BLOCKER | N item(s) to fix  ← 用英文
```

兩個成功函式 (`anchorPass` vs `outputPass`) 的格式就不一樣，AI 需要處理多種格式變體。

---

### Issue 6: 終端截斷與 Log 讀取穩定性 (Terminal Truncation & Log Reading Reliability)

**背景**: 原本設計是讓 AI 從終端直接讀取完整輸出，但實戰發現**多數 IDE 介面 (Cursor, Windsurf, Kiro 等) 會截斷終端輸出**，導致 AI 拿到不完整的資訊。因此架構演化為「存 log → 讓 AI 讀 log」。

**然而新問題出現**: AI 讀 log 的行為**不具確定性** — 有時會讀，有時不會。

#### 根因分析

```
設計演化路徑:

v1: 全部印終端讓 AI 直接讀
    → 問題: IDE 終端截斷、buffer 卡住、輸出不完整
    → 結果: AI 拿到殘缺資訊，修復方向錯誤
    
v2: 存 log + 終端也印
    → 解決了截斷問題 (AI 可以讀 log)
    → 但: 終端和 log 內容 100% 相同
    → 結果: AI 認為「終端已有足夠資訊，不需要讀 log」
    → AI 讀 log 的行為不穩定 (50~70%)
```

#### AI 不讀 log 的心理模型

```
場景 A: 終端被截斷 (輸出不完整)
  → AI: 資訊不夠，我需要讀 log     ✅ 會去讀

場景 B: 終端完整輸出 (未截斷)
  → AI: 我已經看到所有資訊了       ❌ 不讀 log
  → 但 log 可能有更多細節...

場景 C: Workflow 說要讀 log，但終端已有答案
  → AI: 兩個指示矛盾，我選擇效率高的  ⚠️ 不確定
```

**核心矛盾**: 終端和 log 的**內容無差異化**，AI 沒有動機去讀 log。

#### 「詳情:」vs「@READ:」的引導差異

```
❌ 被動提示 (現狀):
  詳情: .gems/iterations/iter-1/logs/build-phase-2-error.log
  → AI 解讀: 「喔，有個 log 在那裡 (可選閱讀)」

✅ 主動指令 (改善):
  @READ: .gems/iterations/iter-1/logs/build-phase-2-error.log
    ↳ 包含: 修復範例 + GATE_SPEC + 缺失項目明細
  → AI 解讀: 「我必須讀這個檔案才知道怎麼修」
```

**影響**: 這是目前系統中影響最大的問題。AI 不讀 log → 瞎猜修復方向 → 重試次數增加 → token 浪費 → 策略漂移升級。

---

### Issue 7: 雙軌輸出系統矛盾 (Dual Output System Conflict)

系統存在**兩套平行的結果通報機制**，而且它們不同步：

| 軌道 | 機制 | 給誰看 | 使用率 |
|------|------|--------|-------|
| A: `log-output.cjs` | 終端 + .log 檔案 | AI Agent | 20/20 steps ✅ |
| B: `step-result.cjs` | `.gems/last_step_result.json` | loop.cjs 腳本 | **1/20 steps** ❌ |

`writeStepResult()` 只有 `poc/step-4.cjs` 在用！其他 19 個 step 都沒用。
這讓 `loop.cjs` 大部分時間只能靠解析 console 輸出來猜 verdict。

**建議**: 要嗎全部 step 都用 `writeStepResult()`，要嗎移除它。不要兩邊都留半套。

---

### Issue 8: 各 Step 使用的輸出函式不一致 (Step Output Function Inconsistency)

各 step 自行選擇輸出函式，導致引導品質差異巨大：

```
輸出函式使用分布:

anchorOutput (v1.5 萬能函式):   16/20 step 還在用  ← 最不一致的輸出
anchorErrorSpec (v2.0):         12/20 step 有用  ← 最好的引導
anchorTemplatePending (v2.0):    8/20 step 有用  ← 良好
emitTaskBlock (v2.5):            2/20 step 有用  ← 最新但採用率低

純用 v1.5 老函式的 step:  poc-1, poc-2, plan-1, plan-4, scan
→ 這 5 個 step 的引導品質只有 2-3/10

inline require saveLog:   phase-2, 5, 7, 8 繞過 log-output 直接存檔
inline require emitTaskBlock: phase-4 在函式內部才 require
```

**根因**: 不是 log-output 設計問題，而是各 step **自己選了不同品質的輸出函式**。
引導品質不一致的真正原因在這裡，不在 log-output 本身。

---

### Issue 9: error-classifier 價值可疑 (Error Classifier ROI)

`error-classifier.cjs` 的分析結果 (`@ANALYSIS`) **只存到 log 裡，終端不會印出來**。
而且 AI 不一定會讀 log (Issue 6)，所以分析結果經常白做。

```
現狀流程:
errorClassifier.classifyError() → @ANALYSIS [RECOVERABLE] → 存到 log → AI 可能不讀

而且 classifier 的 suggestion 像:
  "為 P0 函式加入 GEMS-DEPS-RISK 和 GEMS-FLOW 標籤"
這跟 anchorErrorSpec 的 MISSING 列表完全重複。
```

**建議**: 把 classifier 的 `recoverable` 判斷整合到 signal 選擇邏輯：
- `recoverable: true` → 輸出 `@FIX`
- `recoverable: false` → 輸出 `@BLOCK`
- `recoverable: 'maybe'` → 輸出 `@FIX` 但加 `level=uncertain`

---

### Issue 10: 施工紅線內容不一致 (Guard Content Inconsistency)

四個不同版本的「你不能做什麼」：

| 來源 | 內容 | 行數 |
|------|------|------|
| `anchorOutput` [MILITARY-SPECS] | 禁止修改 task-pipe + 禁止 sudo + 禁止 npm -g + 禁止 pip... | 12 行 |
| `anchorError` @REPEAT-RULE | 🚫 task-pipe \| ✅ 專案檔案 | 1 行 |
| `anchorErrorSpec` @FORBIDDEN | 🚫 讀 task-pipe + 🚫 改 logs + ✅ 目標檔案 | 3 行 |
| `emitTaskBlock` @FORBIDDEN | 🚫 讀 task-pipe + 🚫 回讀架構文件 + ✅ 執行 @TASK | 3 行 |

**AI 到底要遵守哪一版？** 四種版本的規則不同，有的說禁止 pip，有的沒提。

---

### Issue 11: FULL_OUTPUT_REFERENCE.md 文件落差 (Documentation Drift)

| 文件定義 | 實際狀況 |
|---------|----------|
| `@NEEDS_CLARIFICATION` | ❌ 沒有任何函式輸出這個 |
| `@PLAN_ROLLBACK` Level 3 策略漂移 | ❌ 只有 `@BACKTRACK_HINT`，沒有 PLAN_ROLLBACK |
| `@GEMS-VERIFIED` / `@GEMS-CONTRACT` | ⚠️ step 腳本直接 console.log，不經 log-output |
| `@LOG` | ⚠️ 代碼註解寫「不再重複印出」|

---

### Issue 12: @PASS 後續引導太弱 (Weak Post-PASS Guidance)

成功時 AI 只看到：
```
@PASS | BUILD Phase 2 | 標籤驗收通過 (覆蓋率: 95%)
下一步: node task-pipe/runner.cjs ...
```

**缺少**:
- Phase 3 要做什麼？AI 要去查文件或猜
- 目前進度如何？Story 1/4? Phase 2/8?
- context 丟失 — AI 不知道整體在哪裡

---

## 📐 第二部分：改善方案 (Improvement Plan)

### 🔴 改善 P-1: 強制 Log 讀取架構 (最高優先 — Terminal Signal Only)

> **目標**: 解決 AI 讀 log 行為不穩定的問題。透過「資訊落差」策略，讓 AI **必須**讀 log 才能完成修復。
> **來源**: Anthropic Isolate Pillar + Action Affordance + IDE 終端截斷實戰經驗

#### P-1-1: Terminal Signal Only — 終端只印控制信號

**核心策略**: 終端**不印修復細節**，只印「信號 + 目標 + log 指標 + 下一步」。
修復所需的完整資訊（缺什麼、範例、GATE_SPEC）**只存在 log 裡**。

```
=== v2 現狀: AI「可能」讀 log (不穩定) ===

終端印出:
  @TACTICAL_FIX (1/3) | 標籤缺失
  📁 目標檔案: src/modules/recipe/services/recipe-service.ts   ← 有
  ❌ 缺少項目: GEMS-FLOW, GEMS-DEPS                           ← 有！
  📋 範例 (可直接複製):                                         ← 有！！
  /** GEMS: createRecipe | P0 | ✓✓ | ... */
  修復後: node task-pipe/runner.cjs ...                         ← 有
  詳情: .gems/.../error.log                                     ← 可選

→ AI 心理: 「我什麼都知道了，幹嘛還讀 log？」
→ 結果: ~50% 機率讀 log


=== v3 改善: AI「必須」讀 log (確定性) ===

終端只印:
  @FIX (1/3) | BUILD Phase 2 | 標籤缺失
  TARGET: src/modules/recipe/services/recipe-service.ts
  @READ: .gems/.../build-phase-2-error.log
    ↳ 包含: MISSING 明細 + 修復範例 + GATE_SPEC
  NEXT: node task-pipe/runner.cjs --phase=BUILD --step=2

→ AI 心理: 「我知道哪個檔案有問題(TARGET)，但不知道具體缺什麼...
            我必須讀 @READ 指向的 log 才能修」
→ 結果: ~99% 機率讀 log
```

**關鍵差別**: v3 故意**不把 MISSING、範例、GATE_SPEC 印到終端**。
AI 從終端知道 WHO (哪個檔案) 和 WHERE (log 路徑)，
但不知道 WHAT (具體缺什麼) 和 HOW (怎麼修)。
→ 這個「資訊落差」迫使 AI 必須讀 log。

#### P-1-2: `@READ` 標記設計 — Action Affordance

**原則**: 一個指令如果「看起來像該被執行」，AI 就更可能執行它。

| 引導方式 | AI 讀取機率 | 原因 |
|---------|-----------|------|
| `詳情: path` | ~30% | 被動描述，像「附註」 |
| `LOG: path` | ~50% | 稍微主動，但仍像「參考」 |
| `@READ: path` | ~80% | `@` 標記 = Signal = 該執行的動作 |
| `@READ: path` + `↳ 包含: ...` | ~95% | 告訴 AI「你需要的東西在裡面」 |
| `@READ: path` + 終端無修復細節 | ~99% | 不讀就無法修復，沒有選擇 |

**`@READ` 標記規格:**
```
@READ: {relative_log_path}
  ↳ 包含: {內容摘要，用 3-5 個關鍵詞}
```

範例:
```
@READ: .gems/iterations/iter-1/logs/build-phase-2-Story-1.0-error-2026-02-14.log
  ↳ 包含: MISSING 明細 + GEMS 標籤範例 + GATE_SPEC 檢查項
```

#### P-1-3: Log 檔案內容強化 — 完整修復資訊

既然細節都在 log 裡，log 的內容品質變得更重要：

```
Log 檔案結構 (v3):

=== SIGNAL ===
@FIX (1/3) | BUILD Phase 2 | 標籤缺失

=== TARGET ===
FILE: src/modules/recipe/services/recipe-service.ts
MISSING: GEMS-FLOW, GEMS-DEPS

=== GATE_SPEC ===
❌ GEMS-FLOW: Step1→Step2→Step3 格式
❌ GEMS-DEPS: [Type.Name (說明)] 格式  
✅ GEMS 基本標籤: 已存在
✅ Priority: P0 標記正確

=== EXAMPLE (可直接複製) ===
/**
 * GEMS: createRecipe | P0 | ✓✓ | (title,ingredients)→Recipe | Story-1.1 | 建立食譜
 * GEMS-FLOW: ValidateInput→ProcessData→SaveToDB→ReturnResult
 * GEMS-DEPS: [Service.StorageService (資料存取)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: create-recipe.test.ts
 */

=== NEXT ===
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-1.0

=== GUARD ===
🚫 禁止修改 task-pipe/ 和 sdid-tools/ | ✅ 只能修改 TARGET 檔案
```

#### P-1-4: 三處閉環引導 — 消除讀 log 的不確定性

**原則**: 從三個不同的 context 來源，都指向同一個動作 (讀 log)，
AI 在任何路徑下都會被引導到正確行為。

```
引導源 1: log-output.cjs 終端輸出
  → @READ: .gems/.../error.log
    ↳ 包含: MISSING + 範例 + GATE_SPEC

引導源 2: ralph-loop.md workflow
  → ❌ 當輸出 @FIX 或 @BLOCK:
    1. 讀取 @READ 指向的 log 檔案
    2. 依據 log 中 MISSING + EXAMPLE 修復 TARGET 檔案
    3. 執行 NEXT 指令

引導源 3: log 檔案本身 (自包含)
  → 開頭有 SIGNAL，結尾有 NEXT
  → AI 讀完 log 就知道完整的 WHO/WHAT/HOW/NEXT
```

**三處閉環的穩定性:** AI 無論從哪個入口進入，都會被導向「讀 log → 修檔案 → 跑 NEXT」。

#### P-1-5: ralph-loop.md 對應更新

```markdown
# 建議更新 ralph-loop.md 的失敗處理段落:

### 3. 處理結果

✅ @PASS → 自動執行 NEXT 指令

❌ @FIX / @BLOCK → 必須讀 log 修復:
  1. 讀取輸出中 `@READ:` 指向的 log 檔案 (view_file)
  2. 依據 log 中 `MISSING:` 和 `EXAMPLE:` 修復 `TARGET:` 檔案
  3. ⚠️ 只能修改 TARGET 檔案，禁止改 task-pipe/
  4. 執行 `NEXT:` 指令

⚠️ 不要猜測修復內容，log 裡有完整範例。
```

#### P-1-6: 實作變更範圍

| 檔案 | 變更 | 說明 |
|------|------|------|
| `task-pipe/lib/shared/log-output.cjs` | 重構所有 anchor* 函式 | 終端不印 MISSING/EXAMPLE/GATE_SPEC |
| `sdid-tools/lib/log-output.cjs` | 同步重構 | 保持雙引擎一致 |
| `ralph-loop.md` | 更新失敗處理段落 | `@READ` 標記引導 |
| `task-pipe.md` | 更新失敗處理段落 | 同步 |
| `FULL_OUTPUT_REFERENCE.md` | 新增 `@READ` 標記定義 | 文件對齊 |

---

### 改善 P0: Signal Protocol 標準化 (核心)

> **目標**: 定義一套統一、無歧義的 Signal Protocol，讓所有輸出函式遵守。

#### P0-1: 統一 Signal 結構定義

```
=== Signal Protocol v2.0 ===

所有輸出必須遵循:

HEADER_LINE: @{SIGNAL} | {SCOPE} | {SUMMARY}
TARGET:      TARGET: {file_path}           (錯誤時)
READ:        @READ: {log_path}             (錯誤時，強制讀取)
               ↳ 包含: {content_summary}
DIRECTIVE:   NEXT: {command}
GUARD:       @GUARD: {constraints}         (首次錯誤時)
```

**Signal 統一命名表 (消除同義衝突):**

| 現狀 | 新定義 | 理由 |
|------|-------|------|
| `@PASS` | `@PASS` | ✅ 保留 |
| `@BLOCKER` | `@BLOCK` | 縮短，更精準 |
| `@TACTICAL_FIX` | `@FIX` | 縮短，token 友好 |
| `@ARCHITECTURE_REVIEW` | `@REVIEW` | 明確表示需人工介入 |
| `@TEMPLATE_PENDING` | `@FILL` | 語義直接：「填空」|
| `@ERROR_SPEC` | `@SPEC_ERR` | 保留精準錯誤語義 |
| `@STRATEGY_DRIFT` | `@DRIFT` | 縮短 |
| `@TAINT_ANALYSIS` | `@TAINT` | 縮短 |
| `@INCREMENTAL_HINT` | `@SCOPE` | 更明確：驗證範圍 |
| `@NEEDS_CLARIFICATION` | `@CLARIFY` | 縮短 |
| `@REPEAT-RULE` / `@FORBIDDEN` | `@GUARD` | 統一施工紅線 |
| `@ITERATION_ADVICE` | 移除 | 與 @FIX 合併 |
| *(新增)* `@READ` | `@READ` | 強制 AI 讀取 log 檔案 |

**Token 節省估算**: 每個標記平均縮短 5-8 字元，在一個 Story (平均 20+ 次輸出) 中可節省 ~200 tokens。

---

#### P0-2: 消除「語義偷換」問題

**現狀問題**: `anchorOutput()` L361-367 會將 `BLOCKER` → `ARCHITECTURE_REVIEW`, `TACTICAL_FIX` → `ITERATION_ADVICE`。這個語義轉換:
- 文件中沒有記錄
- 實際使用時造成混淆（AI 被告知要找 `@BLOCKER`，但實際輸出是 `@ARCHITECTURE_REVIEW`）

**方案**: 
- **移除隱式轉換**, Signal 就是 Signal，不做「語義美化」
- 如果需要情緒控制，用 `level` 欄位：`@BLOCK | level=review | ...`

---

### 改善 P1: Token Budget 管理 (高影響)

> **來源**: Anthropic Compress Pillar + Token Budget Management

#### P1-1: 分層輸出策略 (Layered Output)

```javascript
// 新架構：Signal Layer + Context Layer + Archive Layer

// Signal Layer: 必印到終端 (估算 30-50 tokens)
@PASS | BUILD Phase 2 | 標籤驗收通過 (覆蓋率: 95%)
NEXT: node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0

// Context Layer: 條件性印出 (錯誤時才印，估算 50-100 tokens)
@TARGET: src/modules/recipe/services/recipe-service.ts
@MISSING: GEMS-FLOW, GEMS-DEPS
@GATE: [{name:"GEMS-FLOW",pass:false},{name:"GEMS-DEPS",pass:false}]

// Archive Layer: 存檔不印 (需要時 AI 讀 log)
@LOG: .gems/iterations/iter-1/logs/build-phase-2-Story-1.0-error-2026-02-14.log
// log 檔案內含: 完整範例、策略漂移詳情、影響分析
```

**Token 節省估算**: 
- 現狀平均錯誤輸出: ~400 tokens
- 改善後: ~150 tokens (Signal+Context) + LOG pointer
- 節省: ~60% token per error output

#### P1-2: Adaptive Prompt Repetition

**現狀**: 每個錯誤都附 `[MILITARY-SPECS]`（12 行）+ `@REPEAT-RULE`（2 行）= 每次 ~80 tokens。

**改善**: 
```
首次錯誤: 印完整 @GUARD 規則 (1 次/Story)
重試 1-3: 印精簡版 @GUARD (1 行)
重試 4+:  印超精簡版 (不印，因為 AI 已看過多次)
```

```javascript
// 實作概念
function getGuardOutput(attemptCount) {
  if (attemptCount <= 1) {
    return '@GUARD\n  🚫 禁止修改 task-pipe/ 和 sdid-tools/\n  ✅ 只能修改專案檔案';
  } else if (attemptCount <= 3) {
    return '@GUARD: 🚫 task-pipe/ | ✅ 專案檔案';
  } else {
    return ''; // 已重複夠多次
  }
}
```

**Token 節省**: 重試 2-3 次時節省 ~60 tokens/次，重試 4+ 次時節省 ~80 tokens/次。

#### P1-3: Adaptive Example (範例自適應)

```javascript
// 現狀: 每次 @SPEC_ERR 都附完整範例 (~200 tokens)
// 改善: 根據 Agent 經驗動態調整

function getExampleDepth(storyId, phase, step, retryCount) {
  const prevPasses = checkPreviousPassCount(storyId, phase, step);
  
  if (prevPasses === 0 && retryCount === 0) {
    return 'FULL';      // 第一次：完整範例
  } else if (retryCount <= 2) {
    return 'DIFF_ONLY';  // 重試：只印缺少的部分
  } else {
    return 'POINTER';    // 多次重試：只給 log 路徑
  }
}
```

---

### 改善 P2: Context 分層架構 (中期)

> **來源**: Anthropic 4 Pillars (Curate / Persist / Isolate / Compress)

#### P2-1: Context Package 概念

定義 **Context Package** 作為每次輸出的標準結構:

```typescript
interface ContextPackage {
  // Curate: 精選資訊
  signal: Signal;          // @PASS | @BLOCK | @FIX | @FILL | @SPEC_ERR
  scope: string;           // "BUILD Phase 2 | Story-1.0"
  summary: string;         // 一句話摘要
  
  // Persist: 持久化
  directive: string;       // NEXT command
  logPath?: string;        // 詳情 log 路徑
  
  // Isolate: 上下文隔離
  target?: {               // 只在錯誤時提供
    file: string;
    missing: string[];
    gateSpec: GateCheck[];
  };
  
  // Compress: 壓縮策略
  exampleDepth: 'FULL' | 'DIFF_ONLY' | 'POINTER';
  guardDepth: 'FULL' | 'SHORT' | 'NONE';
}
```

#### P2-2: JIT (Just-In-Time) Context Retrieval

**現狀**: `@TEMPLATE_PENDING` 直接把 100+ 行模板印到終端。
**改善**: 
```
Signal Layer:  @FILL | PLAN Step 2 | 需建立 Implementation Plan
Context Layer: @TARGET: .gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md
               @FILL_ITEMS: ["Story 目標", "工作項目表格", "規格注入"]
               @GATE: [{name:"Story 目標",pattern:"/Story 目標/i"}, ...]
Archive Layer: TEMPLATE_LOG: .gems/.../plan-step-2-template-2026-02-14.log
               (AI 需要時讀取完整模板)
```

**優勢**: 
- 終端只印 5 行 (vs 現狀 30-50 行)
- AI 通常已知道模板結構（尤其是 Story-1.1+），不需要每次重看
- 如真的需要，AI 可以主動讀取 log 獲取完整模板

---

### 改善 P3: 雙引擎對齊 (sdid-tools ↔ task-pipe)

#### P3-1: 共享 Protocol 層

```
新架構:
shared/
├── signal-protocol.cjs   ← 新！Signal Protocol 核心定義
├── output-renderer.cjs   ← 新！統一輸出渲染
└── log-storage.cjs       ← 從 log-output.cjs 拆出存檔邏輯

task-pipe/lib/shared/
├── log-output.cjs        ← 改為引用 shared/ 層
└── (其他模組不變)

sdid-tools/lib/
├── log-output.cjs        ← 改為引用 shared/ 層
└── (其他模組不變)
```

#### P3-2: Feature Parity Matrix

Blueprint Flow 應該擁有的功能（目前缺失）:

| 功能 | Priority | 理由 |
|------|----------|------|
| `emitTaskBlock` 等效功能 | P1 | Blueprint 也有修復需求 |
| 策略漂移追蹤 | P2 | blueprint 也有重試循環 |
| 錯誤分類 | P2 | 減少 Agent 走錯路 |
| 染色分析 | P3 | 活藍圖的函式有依賴圖 |

---

### 改善 P4: 輸出語言一致性

#### P4-1: 語言策略定義

**建議**: 採用 **「標記英文 + 值中文」** 策略

```
Before (混雜):
  @PASS | POC Step 1 | Draft 驗證通過，{N} 個功能需求已確認
  下一步: node task-pipe/runner.cjs ...
  修復後: node task-pipe/runner.cjs ...

After (統一):
  @PASS | POC Step 1 | Draft 驗證通過，{N} 個功能需求已確認
  NEXT: node task-pipe/runner.cjs ...
  (成功和錯誤都用 NEXT，不再區分「下一步」vs「修復後」)
```

**理由**:
- 標記/欄位名用英文 → 方便 AI 正確解析，不受中文分詞影響
- 值用中文 → 人類開發者能直觀理解
- 消除「下一步」vs「修復後」的同義詞問題 → 統一為 `NEXT`

#### P4-2: 欄位名統一表

| 現狀 (混雜) | 統一後 | 說明 |
|------------|--------|------|
| 下一步 | `NEXT:` | 成功時的下一步 |
| 修復後 | `NEXT:` | 錯誤時的下一步 (同上) |
| 詳情 | `LOG:` | log 檔案路徑 |
| 目標檔案 | `TARGET:` | 要修改的檔案 |
| 缺少項目 | `MISSING:` | 缺少什麼 |
| 修復後執行 | `NEXT:` | 合併到 NEXT |
| 填寫完成後執行 | `NEXT:` | 合併到 NEXT |

---

### 改善 P5: 輸出函式整併 (Function Consolidation)

> **目標**: 從 10 個函式整併為 4 個，強制統一引導品質

```
整併方案:

outputPass + anchorPass        → emitPass(scope, summary, nextCmd, options)
outputError + anchorError      ┐
anchorErrorSpec + emitTaskBlock ┘→ emitFix(spec, options)
outputTemplate                 ┐
anchorTemplatePending          ┘→ emitFill(spec, options)
anchorOutput (error場景)        → emitBlock(spec, options)
anchorOutput (成功場景)        → emitPass
anchorOutput (填空場景)        → emitFill
outputStructured               → 移除 (合併到以上)
```

**引導品質最低標準 (所有 emit* 必須包含)**:
```
✅ SIGNAL:   @{SIGNAL} | {scope} | {summary}        ← 第一行
✅ NEXT:     NEXT: {command}                         ← 最後一行

錯誤/填空時額外增加:
✅ TARGET:   TARGET: {file_path}
✅ READ:     @READ: {log_path} + ↳ 包含: ...
✅ GUARD:    @GUARD: {constraints}   (首次時)
```

---

### 改善 P6: 歷史 Hint — 輕量記憶機制

> **目標**: 提供「上次這裡跌倒過」的路標，讓 AI 少犯重複錯誤

```javascript
// 在 emitFix 輸出時，自動掃描同 phase+step 的歷史 error log
function getHistoricalHint(projectRoot, iteration, phase, step, currentStory) {
  const logsDir = getLogsDir(projectRoot, iteration);
  if (!fs.existsSync(logsDir)) return null;
  
  const pastErrors = fs.readdirSync(logsDir)
    .filter(f => f.includes(`${phase}-${step}`) && 
                 f.includes('error') && 
                 !f.includes(currentStory));
  
  if (pastErrors.length === 0) return null;
  
  // 讀最近的一個，抓 MISSING 行
  const lastError = fs.readFileSync(
    path.join(logsDir, pastErrors[pastErrors.length - 1]), 'utf8');
  const missingMatch = lastError.match(/MISSING:?\s*(.+)/i);
  
  if (missingMatch) {
    return `前一個 Story 在此步驟曾因「${missingMatch[1].trim()}」失敗`;
  }
  return `前一個 Story 在此步驟曾失敗 ${pastErrors.length} 次`;
}
```

**輸出效果:**
```
@FIX (1/3) | BUILD Phase 2 | 標籤缺失
TARGET: src/modules/recipe/services/recipe-service.ts
@READ: .gems/.../build-phase-2-error.log
@HINT: 前一個 Story 在此步驟曾因「GEMS-FLOW, GEMS-DEPS」失敗   ← 新增！1 行！
NEXT: node task-pipe/runner.cjs --phase=BUILD --step=2
```

**成本**: ~20 行程式碼。**收益**: 可能每個 Story 少重試 1-2 次。

---

### 改善 P7: Step 使用標準化 (Step Output Standardization)

> **目標**: 所有 step 統一使用新的 emit* 函式，消除引導品質差異

**影響範圍:**

| 階段 | 需要更新的 step | 當前狀況 |
|------|-------------|----------|
| POC | step-1, step-2 | 只用 v1.5 → 換用 emitFix |
| PLAN | step-1, step-4 | 只用 v1.5 → 換用 emitFix |
| BUILD | 全部 8 個 phase | 混搭 → 統一 emit* |
| SCAN | scan.cjs | 只用 v1.5 → 換用 emitFix |

**同時解決:**
- 移除所有 inline `require('../../lib/shared/log-output.cjs')` 的 saveLog 直接調用
- 統一在檔案開頭 `require` 一次
- 所有 step 都加上 `writeStepResult()` 或完全移除 step-result.cjs

---

### 改善 P8: @PASS 進度提示 (引導強化)

> **目標**: 成功時提供進度感 + 下一步預告，減少 AI 的 context 丟失

```
現狀:
@PASS | BUILD Phase 2 | 標籤驗收通過
下一步: node task-pipe/runner.cjs ...

改善:
@PASS | BUILD Phase 2 | 標籤驗收通過 (覆蓋率: 95%)
PROGRESS: Story-1.0 [Phase 2/8] | 整體 [Story 1/4]
NEXT: node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-1.0
  ↳ Phase 3: 骨架建立 + GEMS 標籤注入
```

**新增元素:**
- `PROGRESS:` — 當前進度 (phase X/8, story X/N)
- `↳ Phase X:` — 下一步要做什麼的一句話預告

---

## 📎 第三部分：實施路線圖

### 🔴 Phase 0: 強制 Log 讀取 (最高優先 — 半天)
- [ ] 重構輸出函式 — 終端不印 MISSING/EXAMPLE，改為 `@READ` 指標
- [ ] 強化 log 檔案內容結構 (SIGNAL/TARGET/GATE_SPEC/EXAMPLE/NEXT/GUARD)
- [ ] 更新 `ralph-loop.md` + `task-pipe.md` — `@READ` 引導 + 三處閉環
- [ ] 同步 `sdid-tools/lib/log-output.cjs`

### Phase 1: 函式整併 (1-2 天)
- [ ] 建立 `emitPass / emitFix / emitFill / emitBlock` 四個新函式
- [ ] 統一施工紅線為單一版本 `@GUARD`
- [ ] 加入 `@HINT` 歷史提示功能 (~20 行)
- [ ] 加入 `PROGRESS:` 進度提示到 emitPass
- [ ] 決定 step-result.cjs 命運: 全部 step 採用或移除

### Phase 2: Step 標準化 (2-3 天)
- [ ] 更新所有 20+ 個 step 檔案 — 換用新 emit* 函式
- [ ] 移除所有 inline `require saveLog` 直接調用
- [ ] 整合 error-classifier 到 signal 選擇邏輯
- [ ] 標記舊函式為 `@deprecated` (過渡期)

### Phase 3: 文件對齊 + Token 優化 (1-2 天)
- [ ] 更新 `FULL_OUTPUT_REFERENCE.md` — 移除孤兒定義 + 新增 @READ/@HINT
- [ ] 新增 `SIGNAL_PROTOCOL.md`
- [ ] 實作 Adaptive Prompt Repetition
- [ ] 實作 Adaptive Example Depth
- [ ] 消除雙引擎 API 差異

### Phase 4: 驗證 (1 天)
- [ ] 跑一個完整的 Story (S 級) 驗證新輸出
- [ ] 確認 AI 在 @FIX/@BLOCK 時 100% 讀 log
- [ ] 確認所有 step 的引導品質 ≥ 7/10
- [ ] 確認 ralph-loop skill 的輸出解析無誤
- [ ] 記錄 token 消耗前後對比

---

## 📊 第四部分：影響評估

### Token 效率改善預估

| 場景 | 現狀 tokens | 改善後 tokens | 節省 |
|------|------------|-------------|------|
| 一次 @PASS 輸出 | ~50 | ~40 | 20% |
| 一次 @ERROR_SPEC 輸出 | ~400 | ~150 | 62% |
| 一次 @TEMPLATE_PENDING | ~600 | ~120 | 80% |
| 一次 emitTaskBlock | ~350 | ~180 | 49% |
| 施工紅線 (per error) | ~80 | ~20 (avg) | 75% |
| **一個完整 Story (S 級)** | **~3000** | **~1200** | **~60%** |

### 向後兼容性

| 變更 | 影響範圍 | 兼容策略 |
|------|---------|---------|
| Signal 標記改名 | ralph-loop skill | 更新 skill 中的 signal 解析邏輯 |
| 「下一步」→ `NEXT:` | AI Agent 解析 | 過渡期同時輸出，2 週後移除 |
| Template 不直接印出 | AI Agent 行為 | 保留 `@LOG` 指引 AI 讀取 |
| 語義轉換移除 | 人類閱讀 | 改用 `level=` 欄位表達嚴重程度 |
| 10→4 個輸出函式 | 20+ 個 step 檔案 | 舊函式標記 @deprecated，過渡 2 週 |
| 施工紅線統一 | 所有錯誤輸出 | 單一版本 @GUARD，不再有 4 種變體 |

---

## 🔑 第五部分：關鍵設計原則 (Design Principles)

基於 Context Engineering 最新研究整理的核心原則：

### 原則 0: 資訊落差驅動行為 (Information Gap Drives Action)
```
❌ 終端印了所有細節 → AI: 「我什麼都知道了，不用讀 log」
✅ 終端只印信號+指標 → AI: 「我必須讀 log 才能修復」

核心: 製造「終端不夠 → log 補完」的資訊梯度，
讓 AI 的最佳策略就是讀 log。
```

### 原則 1: Signal > Description
```
❌ 描述式: "POC Step 1 的 Draft 驗證未通過，因為找不到 requirement_draft 檔案"
✅ 信號式: @FIX | POC Step 1 | Draft 未找到
           TARGET: .gems/.../requirement_draft_iter-1.md
           @READ: .gems/.../poc-step-1-error.log
           NEXT: node task-pipe/runner.cjs --phase=POC --step=1
```

### 原則 2: Token 如預算，精打細算
```
每個 Agent loop 的 token = 貨幣
讓 Agent 用 50 tokens 解決的事，不應該花 500 tokens
```

### 原則 3: Just-In-Time > All-At-Once
```
❌ 一次性: 把完整模板 (100行) 直接印到終端
✅ JIT:    印 5 行摘要 + @READ pointer，Agent 需要時自己讀
```

### 原則 4: 一致勝過完美
```
❌ task-pipe 用 @BLOCKER, sdid-tools 用 @BLOCKER (但格式不同)
✅ 兩個引擎共用 signal-protocol.cjs，輸出格式 100% 一致
```

### 原則 5: Agent 可解析 > 人類可閱讀 (Primary User is AI)
```
❌ 混合語言: "修復後: node ..." + "下一步: node ..."
✅ 機器友好: "NEXT: node ..." (人類一樣能讀懂)
```

### 原則 6: 指令的方向性 (Directive Placement — U-Shape Attention)
```
研究: LLM 注意力呈 U 型曲線 (Primacy + Recency Bias)

開頭: 放「要做什麼」(WHO + WHERE)  ← 高注意力
中間: 放「參考資料」(可選閱讀)      ← 低注意力 (Lost in Middle)
結尾: 放「怎麼做」(NEXT + GUARD)   ← 高注意力

應用到 log 檔案結構:
  === SIGNAL + TARGET ===   ← 開頭: 任務目標
  === GATE_SPEC ===         ← 中間: 參考
  === EXAMPLE ===           ← 中間: 參考
  === NEXT + GUARD ===      ← 結尾: 行動指令
```

---

## 附錄 A: Context Engineering 參考文獻

| 來源 | 核心觀點 | 對齊到的改善項 |
|------|---------|--------------|
| Anthropic "Building Effective Agents" | Curate / Persist / Isolate / Compress 四柱架構 | P2: Context 分層 |
| Google Research arXiv:2512.14982 | Prompt Repetition 對 non-reasoning LLM 有效 | P1-2: Adaptive Repetition |
| Martin Fowler "Context Engineering" | 結構化指令 > 描述式指令 | P0-1: Signal Protocol |
| Anthropic "Tool Design Best Practices" | 工具回應 token 效率化 | P1-1: 分層輸出 |
| MCP Protocol (2025) | 標準化 Agent-Tool 通訊 | P3-1: 共享 Protocol 層 |
| Zed Blog "On Programming with Agents" | 約束 token 空間到只剩正確行動 | P4: 語言一致性 |

| LLM 注意力 U 型曲線 (Primacy/Recency) | 重要指令放開頭/結尾；參考資料放中間 | P-1-3: Log 結構設計 |
| IDE 終端截斷問題 (實戰經驗) | 不依賴終端完整性；資訊存 log | P-1-1: Terminal Signal Only |
| Action Affordance | `@READ` > `詳情:` > `LOG:` | P-1-2: @READ 標記 |

## 附錄 B: Signal Protocol v2.0 Quick Reference

```
=== 成功 ===
@PASS | {scope} | {summary}
NEXT: {command}

=== 可修復錯誤 ===
@FIX ({attempt}/{max}) | {scope} | {summary}
TARGET: {file_path}
MISSING: {item1}, {item2}
NEXT: {command}
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ 專案檔案

=== 結構性阻擋 ===
@BLOCK | {scope} | {summary}
TARGET: {file_path}
MISSING: {item1}, {item2}
@GATE: [{check1:❌}, {check2:✅}]
EXAMPLE_LOG: {log_path}
NEXT: {command}
@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ 專案檔案

=== 需要填空 ===
@FILL | {scope} | {summary}
TARGET: {file_path}
FILL_ITEMS: {item1}, {item2}
@GATE: [{check1:⏳}, {check2:⏳}]
TEMPLATE_LOG: {log_path}
NEXT: {command}

=== 需人工介入 ===
@REVIEW | {scope} | {summary}
LOG: {log_path}
NEXT: 建議：架構師協作

=== 策略漂移 ===
@DRIFT | Level {N}/3 | {TACTICAL/STRATEGY/ROLLBACK}
HINT: {guidance}
@TAINT | {N} functions → {N} dependents
@SCOPE | 驗證: {標籤/測試/整合}
```
