# Design Quality Gate — 評分機制 v1.0

## 概覽

Blueprint 流水線每個節點產出後執行品質評分，防止語意漂移在下游放大。
評分由 AI 自評執行，維度設計具體化是反作弊機制（模糊維度才能偷分）。

```
BLUEPRINT R4  →  [評分]  → R5
BLUEPRINT R5  →  [評分]  → Draft 組裝
POC.HTML      →  [評分]  → Draft 組裝（可選，UI 需確認時）
DRAFT         →  [評分]  → CONTRACT
CONTRACT      →  [評分★最嚴]  → contract-gate → spec-to-plan → BUILD
```

> design-review 是 artifact-level 語意審查，不是 state-machine 的 phase。
> Cynefin 分析嵌入 Blueprint R4/R5 review，不再是獨立節點。

---

## 節點一覽

| 節點 | 門檻 | @GUIDED 下限 | @FAIL 回退位置 | 最多重試 |
|------|------|-------------|--------------|---------|
| BLUEPRINT R4 | 80 | 55 | 重做 R4 | 2 次 |
| BLUEPRINT R5 | 85 | 60 | 重做 R5 | 2 次 |
| DRAFT | 80 | 55 | 局部修復 draft 失分維度 | 2 次 |
| CONTRACT | 90 | 65 | 局部修復 contract 失分維度 | 2 次 |
| POC.HTML | 75 | 50 | 重做 POC | 2 次 |

**@GUIDED 下限說明**: 門檻 − 25（代表仍有修復空間，不需要從頭重做）
**@FAIL 定義**: 分數 < @GUIDED 下限，需要從頭重做對應節點
**@GUIDED 定義**: @GUIDED 下限 ≤ 分數 < 門檻，局部修復後重評

---

## 評分執行者說明

評分由 AI 自評，分兩層：

- **結構性維度**（Interface 完整性、命名一致性）：可機械比對，AI 自評可信度高
- **語意性維度**（AC 精確化、邊界覆蓋）：需要語意判斷，AI 自評依賴維度描述的具體性

反作弊設計：每個維度都有具體的 `@GUIDED` 說明（含反例），AI 無法用模糊理由給高分。

---

## 評分格式（Blocker-first）

**第一段：Blocker Gate**（先判斷，有 blocker 直接停）

```
@NEEDS_FIX
blockers:
  - [具體違規描述]
score: omitted due to blockers
```

**第二段：Quality Score**（無 blocker 才打分）

```
@PASS
score: 86/100
strengths:
  - [優點]
suggestions:
  - [改善建議]
```

各節點的 blocker 條件詳見下方各節。

---

## BLUEPRINT R4 評分（門檻 80）

**觸發時機**: Round 4 迭代規劃完成後，四條硬規則檢查通過前

**Blocker 條件**（直接 @NEEDS_FIX，不進入評分）：
- 功能性 iter 完全缺少前端（SVC 有但無 ROUTE/UI）
- Foundation iter 包含純業務邏輯 action

| 維度 | 分數 | 扣分規則 | @GUIDED 說明 |
|------|------|---------|-------------|
| 垂直切片完整性 | 30 | 每個功能性 iter 缺 SVC/ROUTE/UI 任一扣 10 | 「iter-2 只有 SVC，缺 ROUTE + UI，請補前端串接」 |
| Demo Checkpoint 可驗證性 | 25 | 每個無法親眼驗證的描述扣 8 | 「'系統完成初始化' 無法驗證，改成 '操作者點擊 + 預期畫面反應'」 |
| Action Budget 合規 | 25 | 每個超標 iter 扣 10 | 「iter-3 有 6 個動作，Level M 上限 4，請拆 Story」 |
| Foundation 職責正確 | 20 | Foundation 含業務邏輯扣 10 | 「Foundation 含 Mock Service，請移到業務 iter」 |

### Cynefin Analysis（嵌入 R4，輸出到 Blueprint 設計決策）

R4 評分後，對每個 iter 的 action 做域分析，輸出以下結果（不計入分數，作為設計參考）：

```
domain: Clear / Complicated / Complex
budget note: （若 budget 超標風險）
needsTest candidates: [action 名稱列表]（Complicated/Complex 域，或 hiddenSteps ≥ 2）
boundary warnings: [需注意的邊界條件]
slice advice: （若切分方式有改善空間）
```

**三問判定（每個 action）：**
1. 「這個 action 的實作路徑是否唯一？」→ 是 → Clear；否 → 下一問
2. 「有沒有已知的 best practice 可套用？」→ 是 → Complicated；否 → Complex
3. Complex domain → 建議 POC-FIX 或測試先行

> Cynefin 結果不產生 @PASS/@BLOCKER，只提供設計建議給 Blueprint R5 和 Draft。

---

## BLUEPRINT R5 評分（門檻 85）

**觸發時機**: Round 5 動作細化完成後，Draft 組裝前

**Blocker 條件**（直接 @NEEDS_FIX，不進入評分）：
- P0 action 完全缺少 AC（Given/When/Then 為空）

**Cynefin carry-over 確認**（來自 R4 Cynefin Analysis）：
- R4 標記為 Complicated/Complex 的 action，R5 是否已補具體的邊界/隱含步驟描述？
- needsTest candidates 是否在動作細化中有更具體的 Signature/FLOW？
- 確認無誤後將 needsTest candidates 傳遞到 Draft

| 維度 | 分數 | 扣分規則 | @GUIDED 說明 |
|------|------|---------|-------------|
| AC 非空覆蓋 | 30 | 每個 P0 動作缺 AC 扣 10 | 「createTrainingSession 缺 AC，請補 Given/When/Then」 |
| Then 效益指標 | 30 | 每個停留在實作描述的 Then 扣 8 | 「Then '寫入成功' 是實作描述，改成 '訓練列表顯示新增項目，操作者可立即查看'」 |
| 技術動詞黑名單 | 25 | 每個違規動詞扣 5 | 黑名單：`解析完成 / 回傳結果 / 寫入成功 / 系統記錄 / 操作完成 / 資料已儲存` |
| Story 拆分合規 | 15 | 功能性 iter 少於 2 Story 扣 8 | 「iter-2 只有 Story-0，請補 Story-1（前端串接）」 |

---

## DRAFT 評分（門檻 80）

**觸發時機**: Draft 存檔後，Contract 推導前

**Blocker 條件**（直接 @NEEDS_FIX，不進入評分）：
- P0 action 完全缺少 AC
- 實體定義完全缺少欄位/型別（無法推導 contract）

**Cynefin carry-over 確認**（來自 Blueprint R4 分析結果）：
- Blueprint 判為 Complicated/Complex 的 action → Draft 的 FLOW/Signature 是否已具體化？
- needsTest candidates → 是否已有足夠語意讓 Contract 加入 `@TEST`？
- 若 Blueprint 無 Cynefin 分析（Task-Pipe 直入）→ 跳過此確認

| 維度 | 分數 | 扣分規則 | @GUIDED 說明 |
|------|------|---------|-------------|
| Behavior 具體性 | 30 | 每個 P0 動作缺 AC 扣 10 | 「createTrainingSession 缺 AC，請補 Given/When/Then」 |
| Then 效益指標 | 30 | 每個停留在實作描述的 Then 扣 8 | 「Then '寫入成功' 是實作描述，改成 '訓練列表顯示新增項目，操作者可立即查看'」 |
| 實體/型別對齊 | 25 | 每個缺欄位/型別的實體扣 5；型別模糊扣 3 | 「Transaction 缺 createdAt 欄位型別，請補」 |
| Contract Readiness | 15 | 每個 P0 action 無法從 Draft 推導 Signature 扣 8 | 「deleteTraining FLOW 只有『刪除』，缺少輸入/輸出型別語意」 |

**@FAIL 行為**: 不重跑 5 輪對話，針對失分維度局部修復 draft 檔案後重評。
修復範圍：只改 draft 中對應的 AC 區塊或實體定義，不動其他部分。

---

## CONTRACT 評分（門檻 90，最嚴）

**觸發時機**: contract 草稿完成後，contract-gate 機械驗證前

**為什麼門檻最嚴**: CONTRACT 是 spec-to-plan 的 single source of truth。
前面幾層失分還能往下傳遞修正，CONTRACT 失分會在 BUILD Phase 2 @TEST Gate 直接爆。

**Blocker 條件**（直接 @NEEDS_FIX，不進入評分）：
- P0 action 在 contract 中完全找不到對應宣告
- Draft needsTest candidate 缺少 `@TEST:` 路徑（Contract 只驗存在性，不重跑 Cynefin 三問）
- 型別全部使用 `any`（無法驗證型別邊界）

### CONTRACT 語意擴充說明

contract-writer.cjs 跑完後產出骨架結構，AI 需要介入做語意擴充：

1. **展開 interface 方法簽名**：Draft 動作名稱 + 粗略類型 → 完整 `(input: InputType): OutputType`
2. **精確化 Behavior**：Draft 的 Given/When/Then → 含具體值/型別的可測試規格
3. **補邊界條件**：每個 P0 動作補錯誤狀態描述（衝突、空值、越界）
4. **@TEST 路徑**：只為 Blueprint Cynefin needsTest candidates 加 `@TEST: src/...` 路徑，不重新做域分析

| 維度 | 分數 | 扣分規則 | @GUIDED 說明 |
|------|------|---------|-------------|
| Interface 完整性 | 25 | 每缺一個必要宣告扣 8 | 「Draft 有 createTrainingSession，contract.ts 找不到對應方法簽名」 |
| 型別精度 | 25 | 每個 any/裸 object/unknown 扣 8 | 「getReport 回傳型別是 any，請改成 TrainingReport[]」 |
| Behavior/WHY/Risk 清晰度 | 25 | 每個 P0 action 缺錯誤情境/WHY 描述扣 6 | 「createTrainingSession 缺衝突錯誤 Behavior，請補」 |
| Draft 一致性 | 25 | 每個與 Draft 實體/命名不符扣 5；needsTest candidate 缺 @TEST 扣 10 | 「Draft 用 TrainingSession，contract 用 Training，請統一」 |

**@FAIL 行為**: 局部修復 contract 失分維度後重評，不回退到 Draft 階段。
最多重試 2 次，第 2 次仍 @FAIL 則停止並回報使用者。

---

## POC.HTML 評分（門檻 75）

**觸發時機**: `poc_iter-N.html` 完成後，Draft 組裝前（可選步驟，UI 需確認時使用）

| 維度 | 分數 | 扣分規則 | @GUIDED 說明 |
|------|------|---------|-------------|
| @GEMS-VERIFIED 標記完整 | 30 | 缺標記扣 15，標記不完整扣 8 | 「缺少 @GEMS-VERIFIED 區塊，請補已實作/未實作功能清單」 |
| 功能可操作性 | 30 | 每個無法操作的核心功能扣 10 | 「新增功能按鈕無反應，請補 JS 邏輯」 |
| Mock 資料真實性 | 25 | 每個 lorem ipsum / 假資料扣 5 | 「列表顯示 'Item 1/2/3'，請改成符合業務語意的 Mock 資料」 |
| 樣式策略一致性 | 15 | 與 Round 3 確認的策略不符扣 8 | 「Round 3 確認 Tailwind，POC 用 inline style，請統一」 |

---

## 全授權模式行為

| 次數 | 行為 |
|------|------|
| 第 1 次 @FAIL | 自動局部修復，不回報使用者 |
| 第 2 次 @FAIL | 停止，回報使用者：「[節點名] 評分連續兩次未達門檻，需要人工介入」 |

**注意**: @FAIL 不等於無限循環。每個節點最多重試 2 次，超過才停止。

---

## 給 Reviewer 的開放問題

1. **R5 技術動詞黑名單夠不夠？** 常見假 Then 還有：「系統記錄成功」、「資料已儲存」、「操作完成」— 需要擴充嗎？

2. **CONTRACT 門檻 90 第一次能達到嗎？** 語意擴充對第一次跑的 AI 難度不低，是否需要「第一個 iter 豁免到 80」？

3. **DRAFT @FAIL 局部修復的邊界？** 「只改失分維度」的範圍是否夠清楚，還是需要更精確的定義？
