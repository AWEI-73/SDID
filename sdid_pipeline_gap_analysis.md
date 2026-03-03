# SDID Pipeline 缺口分析報告

**分析日期**: 2026-03-03  
**分析範圍**: Enhanced Draft → Plan → BUILD (Phase 1~8) → VERIFY 全鏈路  
**分析方法**: 逐節點追蹤資料流，識別斷裂點和資訊丟失

---

## 📊 Pipeline 全景圖

```
Enhanced Draft (人寫)
  │
  │ [1] draft-parser-standalone.cjs 解析
  │     ✅ 解出: modules, actions, iterationPlan
  │     ⚠️ AC 被解為欄位 a.ac = "AC-9.2"（只有 ID，沒內容）
  │
  ▼
draft-to-plan.cjs (機械轉換)
  │
  │ [2] 生成 implementation_plan_Story-N.Y.md
  │     ✅ 工作項目表、GEMS 模板、檔案路徑、FLOW、DEPS
  │     ⚠️ AC 變成「見藍圖」指引（間接引用，內容未嵌入）
  │
  ▼
BUILD Phase 1 (phase-1.cjs)
  │
  │ [3] 讀 plan → extractPlanSpec + extractFunctionManifest
  │     ✅ 提取函式清單、FLOW、檔案路徑
  │     ✅ VSC 垂直切片檢查
  │     ❌ 完全沒有讀 AC 內容
  │     ❌ 沒有傳遞 AC 給 AI
  │
  ▼
BUILD Phase 2 (phase-2.cjs)
  │
  │ [4] 掃描標籤 + Plan 比對
  │     ✅ 覆蓋率、P0/P1 合規、檔案路徑比對、FLOW↔STEP 一致性
  │     ❌ 沒有檢查 AC 是否被實作
  │     ❌ GEMS 標籤中沒有 AC 欄位
  │
  ▼
BUILD Phase 3~7
  │     (略，主要是測試、integration、路由等)
  │
  ▼
BUILD Phase 8 (phase-8.cjs)
  │
  │ [5] 完成規格 + Adversarial Review
  │     ✅ Fillback 自動產出
  │     ⚠️ AC 覆蓋檢查存在但方法粗糙（關鍵字匹配測試檔案內容）
  │     ❌ AC 檢查來源是 Plan 而非 Draft（Plan 只有 ID 沒有內容）
  │
  ▼
VERIFY (blueprint-verify.cjs)
  │
  │ [6] 藍圖↔源碼 雙向比對
  │     ✅ techName 名稱比對、priority、flow 步驟數、storyId
  │     ❌ 完全沒有 AC 比對
  │     ❌ 沒有驗證「使用者能做到 Draft 承諾的事」
  │
  ▼
結束
```

---

## 🔴 確認的缺口（真的缺）

### 缺口 1: AC 內容在 Pipeline 中丟失

| 階段 | AC 的狀態 | 問題 |
|------|----------|------|
| **Draft** | ✅ 完整 Given/When/Then | `AC-9.2: Given PDF buffer → When parseBuffer() → Then 結構化文字陣列` |
| **Parser** | ⚠️ 只提取 ID | `a.ac = "AC-9.2"` ← 內容沒被 parse |
| **Plan** | ⚠️ 間接引用 | `**驗收條件**: AC-9.2 (見藍圖「驗收條件」區塊)` |
| **Phase 1** | ❌ 完全缺席 | AI 拿不到 AC 內容 |
| **Phase 2** | ❌ 無檢查 | 標籤系統沒有 GEMS-AC |
| **Phase 8** | ⚠️ 粗糙匹配 | 用關鍵字比對測試檔案（見下方分析） |
| **VERIFY** | ❌ 完全缺席 | 只比名稱/優先級/flow |

**嚴重程度: 🔴 高**  
**影響**: AI 在實作時無法知道具體的驗收標準，只能看函式名推測。VERIFY 時無法驗證使用者案例是否被滿足。

#### Phase 8 AC 檢查的問題（L579-613）

```javascript
// 現有的 AC 覆蓋檢查 — phase-8.cjs L583
const acPattern = /(?:AC|驗收條件|Acceptance)[- ]?(\d+)[.:：]\s*(.+)/gi;
```

問題：
1. **來源錯誤**：從 Plan 讀 AC，但 Plan 裡只有 `AC-9.2 (見藍圖)` → regex 匹配到的 description 是 [(見藍圖「驗收條件」區塊)](file:///c:/Users/user/Desktop/SDID/task-pipe/phases/build/phase-8.cjs#31-516)，不是真正的 AC 內容
2. **匹配方法太弱**：用 AC 描述的關鍵字去搜測試檔案，幾乎什麼都能匹配上
3. **不連 Draft**：沒有回去讀 Draft 取得真正的 AC 內容

---

### 缺口 2: GEMS-DEPS 在 Plan 生成時被歸零

| 階段 | DEPS 狀態 |
|------|----------|
| **Draft** | `依賴: [shared/types, shared/storage]` ← 有模組級依賴 |
| **Plan 生成** | `GEMS-DEPS: 無` ← 全部被設為「無」！ |
| **Phase 2** | 檢查 DEPS 合規性 ← 但 Plan 給的就是「無」 |

**根因**: [draft-to-plan.cjs](file:///c:/Users/user/Desktop/SDID/sdid-tools/draft-to-plan.cjs) L126:
```javascript
const depsStr = (!a.deps || a.deps === '無') ? '無' : a.deps;
```

Draft 動作表的 deps 欄位沒有在動作清單裡。Draft 中的模組依賴在 `### 4. 獨立模組` 區塊定義（如 `依賴: [shared/types, shared/storage]`），但 parser 並沒有把模組級依賴映射到每個 action 的 deps。

**嚴重程度: 🟡 中**  
**影響**: 所有函式的 GEMS-DEPS 都是空的，AI 自己猜依賴。DEPS-RISK 也因此失去意義。

---

### 缺口 3: 函式 Signature 缺失

| 階段 | Signature 狀態 |
|------|---------------|
| **Draft** | 沒有定義（只有業務語意和類型）|
| **Plan** | [(args)→Result](file:///c:/Users/user/Desktop/SDID/task-pipe/phases/build/phase-8.cjs#31-516) ← 佔位符，未指定具體型別 |
| **Phase 1** | AI 自行決定 input/output |
| **Phase 2** | 不檢查 signature 正確性 |

**嚴重程度: 🟡 中**  
**影響**: AI 產出的函式 signature 可能與實際需求不符。同一個函式在不同 Story 被呼叫時，signature 可能不一致。

---

## 🟡 部分缺口（有做但不完整）

### 半缺口 A: Plan 的 GEMS 標籤是「模板」而非「規格」

Plan 中的 GEMS 標籤設計意圖是給 AI 「直接複製貼上」：

```typescript
// @GEMS-FUNCTION: PdfTextExtractor
/**
 * GEMS: PdfTextExtractor | P0 | SVC | (args)→Result | Story-9.0 | PDF 文字提取
 * GEMS-FLOW: PARSE_BUFFER → MATCH_REGEX → EXTRACT_COORDS
 * GEMS-DEPS: 無                    ← 佔位
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: pdf-text-extractor.test.ts
 */
// [STEP] PARSE_BUFFER
// [STEP] MATCH_REGEX
// [STEP] EXTRACT_COORDS
```

**做對的**: FLOW、TEST、TEST-FILE 都是確定值  
**沒做到的**: [(args)→Result](file:///c:/Users/user/Desktop/SDID/task-pipe/phases/build/phase-8.cjs#31-516)、`GEMS-DEPS: 無` 是佔位符

---

### 半缺口 B: VERIFY 只做名稱比對

[blueprint-verify.cjs](file:///c:/Users/user/Desktop/SDID/sdid-tools/blueprint-verify.cjs) 的 [compareActions()](file:///c:/Users/user/Desktop/SDID/sdid-tools/blueprint-verify.cjs#98-213) 只比對：
- ✅ 名稱是否存在（normalize 後模糊匹配）
- ✅ Priority 是否一致
- ✅ Flow 步驟數差異（>2 才報）
- ✅ StoryId prefix
- ❌ **不比 AC 覆蓋**
- ❌ **不比 Signature**
- ❌ **不比 DEPS 正確性**

---

## ✅ 已經做好的部分

| 銜接點 | 做法 | 評價 |
|--------|------|------|
| Draft → Plan 的函式清單 | 機械轉換，零 AI | ✅ 精確可靠 |
| Plan → Phase 1 的檔案路徑 | Architecture Contract 推導 | ✅ 路徑唯一真相源 |
| Plan → Phase 2 的 FLOW↔STEP | compareFlowSteps() 嚴格比對 | ✅ BLOCKER 級門控 |
| Plan → Phase 2 的檔案路徑比對 | compareFilePaths() | ✅ 移位/缺失都能抓 |
| Phase 1 → Phase 2 的標籤覆蓋率 | 基於 manifest 計算 | ✅ 精確到函式 |
| Phase 2 的 STUB-001 偵測 | 空骨架掃描 | ✅ 防假實作 |
| Phase 8 的 P7 對抗式檢查 | fraudIssues + qualityIssues | ✅ 多層防護 |

---

## 📋 缺口優先級排序

| 優先級 | 缺口 | 改動量 | 效益 |
|--------|------|--------|------|
| **P0** | AC 內容進入程式碼標籤 (`GEMS-AC`) | 小（3 檔案） | 高：閉環驗收 |
| **P1** | AC 內容嵌入 Plan（不只是「見藍圖」） | 小（1 檔案） | 中：AI 不用跳回讀 Draft |
| **P1** | Phase 8 AC 檢查改用 Draft 原文 | 中（2 檔案） | 中：驗收真的有效 |
| **P2** | VERIFY 加 AC 覆蓋比對 | 中（1 檔案） | 中：迭代級驗收 |
| **P2** | DEPS 從模組定義推導到 action | 中（parser 改動） | 低：目前 AI 自己補還行 |
| **P3** | Signature 規格化 | 大（Draft 格式要改） | 低：Draft 複雜度上升 |

---

## 🎯 結論

**SDID 的 Pipeline 在「結構追蹤」（檔案路徑、標籤格式、FLOW/STEP）方面做得很扎實。**

**真正缺的是「語意追蹤」— 尤其是 AC（驗收條件）從需求到程式碼到驗證的完整閉環。**

AC 的資料流目前是：

```
Draft ──完整──→ Parser ──只取ID──→ Plan ──間接引用──→ Phase 1 ──丟失──→ 程式碼 ──無標記──→ Phase 8 ──假檢查──→ VERIFY ──沒檢
```

理想狀態：

```
Draft ──完整──→ Parser ──含內容──→ Plan ──嵌入──→ Phase 1 ──GEMS-AC──→ 程式碼 ──掃描──→ Phase 8 ──真檢查──→ VERIFY ──比對
```

**最小可行改動 = P0 + P1 = 4 個檔案，讓 AC 從頭到尾不斷鏈。**

---

## 📐 設計決策備忘（2026-03-03）

### 決策 1: GEMS 標籤 Shrink 格式

SCAN 完成後，標籤從多行壓縮為精簡格式。完整資訊保留在 `functions.json`，人類透過 monitor 規格書閱讀。

```
完整版（BUILD 時）:
/**
 * GEMS: calcScore | P1 | ✓✓ | (factors: Factor[])→number | Story-1.0 | 計算碳排分數
 * GEMS-FLOW: VALIDATE→NORMALIZE→WEIGHT→SUM→RETURN
 * GEMS-DEPS: [SVC.factorService], [LIB.dbClient]
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: calc-score.test.ts
 */
// [STEP] VALIDATE
// [STEP] NORMALIZE
...

Shrink 後:
/** GEMS: calcScore | P1 | VALIDATE→NORMALIZE→WEIGHT→SUM→RETURN */
// src/shared/services/calc-score.ts
// AC-1.2 (Given 係數存在 → 計算成功)
// [STEP] VALIDATE
// [STEP] NORMALIZE
...
```

Shrink 一行三格: `名稱 | Priority | FLOW`
- 名稱 + P: 身份識別，必留
- FLOW: 跟 [STEP] 錨點配對，也是函式用途的最佳摘要
- [STEP] 錨點: 保留不動
- 第二行: 檔案路徑
- AC 行: 保留在路徑行之後、STEP 之前（格式同完整版）
- 砍掉: signature、Story、說明、DEPS、DEPS-RISK、TEST、TEST-FILE（都在 functions.json）

### 決策 2: AC 放進完整版標籤 → 已被決策 4 取代

~~新增 `GEMS-AC: AC-1.2 (...)` 放在標籤區塊內~~

**已改為決策 4**: AC 以 `// AC-X.Y (摘要)` 格式放在標籤 `*/` 之後、`[STEP]` 之前。
理由見決策 4。核心追蹤邏輯不變：Scanner 建立 `函式 → AC` 映射，Phase 8 和 VERIFY 用映射追蹤覆蓋率。

### 決策 3: 文件缺口（P2 後發現）

1. plan-schema.md 缺 GEMS-AC 規則 — 等 AC 穿透實作後加 WARNING 級規則
2. FULL_OUTPUT_REFERENCE_v3.md 的 sdid-tools/lib/log-output.cjs API 表過時 — P2 已統一為 task-pipe 版
3. FULL_OUTPUT_REFERENCE_v3.md 缺 emitPass/emitFix/emitFill/emitBlock（v3.1 Emit 函式）文件
4. Plan 的 `(args)→Result` 全是佔位符 — 低優先，Draft 格式要改才能解

### 決策 4: AC 格式改為標籤外掛行（2026-03-04）

原本考慮放在 GEMS 標籤區塊內（`GEMS-AC:`），改為放在 `*/` 之後、`[STEP]` 之前：

```typescript
/**
 * GEMS: createFactor | P0 | ○○ | (args)→Result | Story-1.1 | 建立係數
 * GEMS-FLOW: Validate→Save→Return
 * GEMS-DEPS: [Shared.types]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: create-factor.test.ts
 */
// AC-1.1 (Given 係數存在 → CRUD 操作成功回傳)
// AC-1.2 (Given 無效輸入 → 回傳錯誤訊息)
// [STEP] Validate
// [STEP] Save
// [STEP] Return
```

理由：
- AC 是「這個函式要滿足什麼」，跟 GEMS 標籤的「這個函式是什麼」是不同層次
- 閱讀順序：規格 → 驗收 → 步驟 → 實作
- Scanner 解析簡單：`// AC-X.Y` 開頭就抓，不用改 GEMS 標籤 parser
- 沒有 AC 的函式就不寫，零噪音
- Shrink 版的 AC 也放在 `*/` 後面（`/** GEMS: ... */` 下一行）

### 決策 5: 骨架預生成 — draft-to-plan 同時產出 .ts 骨架檔（2026-03-04）

draft-to-plan 在產出 `implementation_plan_Story-X.Y.md` 的同時，直接生成 `.ts` 骨架檔到 `src/` 目錄。

骨架檔內容：完整 GEMS 標籤 + AC 行 + [STEP] 錨點 + export 簽名 + `throw new Error('Not implemented')`

```typescript
// src/modules/factor/services/create-factor.ts (由 draft-to-plan 自動生成)

/**
 * GEMS: createFactor | P0 | ○○ | (args)→Result | Story-1.1 | 建立係數
 * GEMS-FLOW: Validate→Save→Return
 * GEMS-DEPS: [Shared.types]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: create-factor.test.ts
 */
// AC-1.1 (Given 係數存在 → CRUD 操作成功回傳)
// [STEP] Validate
// [STEP] Save
// [STEP] Return
export function createFactor(/* TODO */): /* TODO */ {
  throw new Error('Not implemented — Story-1.1 Item 1');
}
```

效果：
- AI 讀 plan 是第一次看規格，骨架檔裡的標籤是第二次看 — 雙重語意錨定提升實作準確度
- Phase 1 從「AI 建骨架」變成「驗證骨架已存在」— 大幅降低 AI 出錯率
- Phase 2 掃標籤幾乎直接 PASS — 標籤是機械生成的，格式保證正確
- patch-untagged 這種事後補救工具不再需要

限制：
- `[Modify]` 類型（改既有檔案）不生成骨架，只在 plan 裡標記
- 骨架不寫 import — AI 填肉時自然會加
- 用 `--scaffold` flag 控制（預設開啟），`--no-scaffold` 可關閉

### 決策 6: 非契約函式的自由新增（不限 Priority）（2026-03-04）

骨架預生成後，契約函式的標籤是鎖死的。但 AI 開發過程中可能需要新增 helper/utility。

規則：
- 契約函式（骨架生成的）：標籤不能改，Phase 2 比對骨架驗證
- AI 自由新增的函式：必須有標籤，Priority 不限（AI 自己判斷）
- 沒標籤的函式：FAIL（跟現在一樣）

Phase 2 新增檢查：
- 骨架函式的標籤被篡改 → BLOCKER（比對 plan manifest）
- 新增函式沒標籤 → BLOCKER

### 決策 7: 標籤降級（備忘，暫不實作）（2026-03-04）

函式的 Priority 可以降級（例如 P1 → P2），如果實作後發現影響端點沒那麼大。
目前有門控腳本的概念但意義不大，暫時不做。
未來如果需要，可以在 Phase 8 Fillback 時自動建議降級。

---

### 待實作項目
### 待實作項目

- [x] **骨架預生成**: draft-to-plan 加 `generateScaffold()` — 產出 .ts 骨架檔（標籤+AC+STEP+簽名）（commit 3373a66）
- [x] **AC 格式**: `// AC-X.Y (摘要)` 卡在標籤 `*/` 後、`[STEP]` 前（commit 3373a66）
- [x] **Phase 2 骨架比對**: 契約函式標籤鎖死，新增函式必須 P3（commit 3373a66）
- [x] **plan-to-scaffold v1.1**: type-aware 骨架生成（CONST/A骨架存在」
- [x] **plan-to-scaffold v1.1**: type-aware 骨架生成（CONST/API/SVC/HOOK/UI/ROUTE/SCRIPT）
- [x] **標籤 Shrink 腳本** (P2): SCAN 後自動執行，三格: 名稱|P|FLOW + 路徑行 + STEP 錨點 (commit e443b34)
- [x] **Scanner 支援 shrink 格式** (P2): 三格版解析 (commit e443b34)
  - Modify 類型跳過不生成接 PASS ✅
- [x] **AC 格式**: `// AC-X.Y (摘要)` 卡在標籤 `*/` 後、`[STEP]` 前
  - 改動: `sdid-tools/draft-to-plan.cjs` 的 plan 模板 + 骨架生成 ✅
- [x] **AC 穿透後續** (P1): Phase 8 真檢查 + VERIFY AC 比對（commit 77e4a0a）
  - phase-8: 改用 scanner `acIds` 映射，AC_NOT_TAGGED（源碼未標記）+ AC_UNCOVERED（測試未覆蓋）
  - blueprint-verify: `checkACCoverage()` + `extractPlanAcIds()`，報告 AC 標記率
  - 改動: `task-pipe/phases/build/phase-2.cjs` 加骨架比對邏輯 ✅
- [ ] **AC 穿透後續**: Phase 8 真檢查 + VERIFY AC 比對
  - 改動: `task-pipe/phases/build/phase-8.cjs` AC 覆蓋改用標籤映射（acIds）
  - 改動: `sdid-tools/blueprint-verify.cjs` 加 AC 覆蓋比對
- [ ] 標籤 Shrink 腳本（SCAN 後自動執行，三格: 名稱|P|FLOW + 路徑行 + STEP 錨點）
- [ ] Scanner 支援 shrink 格式解析（三格版）
- [ ] 文件更新: output reference v3 移除 sdid-tools 獨立 API 表 + 補 v3.1 Emit 函式
- [ ] plan-schema 加 AC_FIELD 規則（等 AC 穿透後）
- [ ] DEPS 從模組定義推導到 action（低優先）