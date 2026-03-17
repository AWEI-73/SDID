# Design Quality Gate — 評分機制 v1.0

## 概覽

Blueprint 流水線每個節點產出後執行品質評分，防止語意漂移在下游放大。
評分由 AI 自評執行，維度設計具體化是反作弊機制（模糊維度才能偷分）。

```
BLUEPRINT R4  →  [評分]  → R5
BLUEPRINT R5  →  [評分]  → Draft 組裝
DRAFT         →  [評分]  → CYNEFIN-CHECK → CONTRACT
CONTRACT      →  [評分★最嚴]  → draft-to-plan → BUILD
POC.HTML      →  [評分]  → CYNEFIN-CHECK → PLAN（Task-Pipe 路線）
```

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

## BLUEPRINT R4 評分（門檻 80）

**觸發時機**: Round 4 迭代規劃完成後，四條硬規則檢查通過前

| 維度 | 分數 | 扣分規則 | @GUIDED 說明 |
|------|------|---------|-------------|
| 垂直切片完整性 | 30 | 每個功能性 iter 缺 SVC/ROUTE/UI 任一扣 10 | 「iter-2 只有 SVC，缺 ROUTE + UI，請補前端串接」 |
| Demo Checkpoint 可驗證性 | 25 | 每個無法親眼驗證的描述扣 8 | 「'系統完成初始化' 無法驗證，改成 '操作者點擊 + 預期畫面反應'」 |
| Action Budget 合規 | 25 | 每個超標 iter 扣 10 | 「iter-3 有 6 個動作，Level M 上限 4，請拆 Story」 |
| Foundation 職責正確 | 20 | Foundation 含業務邏輯扣 10 | 「Foundation 含 Mock Service，請移到業務 iter」 |

---

## BLUEPRINT R5 評分（門檻 85）

**觸發時機**: Round 5 動作細化完成後，Draft 組裝前

| 維度 | 分數 | 扣分規則 | @GUIDED 說明 |
|------|------|---------|-------------|
| AC 非空覆蓋 | 30 | 每個 P0 動作缺 AC 扣 10 | 「createTrainingSession 缺 AC，請補 Given/When/Then」 |
| Then 效益指標 | 30 | 每個停留在實作描述的 Then 扣 8 | 「Then '寫入成功' 是實作描述，改成 '訓練列表顯示新增項目，操作者可立即查看'」 |
| 技術動詞黑名單 | 25 | 每個違規動詞扣 5 | 黑名單：`解析完成 / 回傳結果 / 寫入成功 / 系統記錄 / 操作完成 / 資料已儲存` |
| Story 拆分合規 | 15 | 功能性 iter 少於 2 Story 扣 8 | 「iter-2 只有 Story-0，請補 Story-1（前端串接）」 |

---

## DRAFT 評分（門檻 80）

**觸發時機**: Draft 存檔後，CYNEFIN-CHECK 前

| 維度 | 分數 | 扣分規則 | @GUIDED 說明 |
|------|------|---------|-------------|
| AC 非空覆蓋 | 30 | 每個 P0 動作缺 AC 扣 10 | 同 R5 規則 |
| Then 效益指標 | 30 | 每個停留在實作描述的 Then 扣 8 | 同 R5 規則，黑名單相同 |
| 技術動詞黑名單 | 25 | 每個違規動詞扣 5 | 黑名單：`解析完成 / 回傳結果 / 寫入成功 / 系統記錄 / 操作完成 / 資料已儲存` |
| 實體定義完整性 | 15 | 每個缺欄位/型別的實體扣 5 | 「Transaction 缺 createdAt 欄位型別，請補」 |

**@FAIL 行為**: 不重跑 5 輪對話，針對失分維度局部修復 draft 檔案後重評。
修復範圍：只改 draft 中對應的 AC 區塊或實體定義，不動其他部分。

---

## CONTRACT 評分（門檻 90，最嚴）

**觸發時機**: AI 語意擴充完成後，draft-to-plan 前

**為什麼門檻最嚴**: CONTRACT 是 draft-to-plan 的 single source of truth。
前面幾層失分還能往下傳遞修正，CONTRACT 失分會在 BUILD Phase 2 AC Gate 直接爆。

### CONTRACT 語意擴充說明

contract-writer.cjs 跑完後產出骨架結構（interface 形狀），AI 需要介入做語意擴充：

1. **展開 interface 方法簽名**：把 Draft 的動作名稱 + 粗略類型 → 完整 `(input: InputType): OutputType`
2. **精確化 AC**：把 Draft 的 Given/When/Then 語意描述 → 含具體值/型別的可測試規格
3. **補邊界條件**：每個 P0 動作補錯誤狀態 AC（衝突、空值、越界）

| 維度 | 分數 | 扣分規則 | @GUIDED 說明 |
|------|------|---------|-------------|
| Interface 完整性 | 25 | 每缺一個方法扣 8 | 「Draft 有 createTrainingSession，contract.ts 找不到對應方法簽名」 |
| 型別具體性 | 20 | 每個 any/裸 object/unknown 扣 8 | 「getReport 回傳型別是 any，請根據 Draft 實體定義改成 TrainingReport[]」 |
| AC 精確化 | 25 | 每個仍停留在 Draft 語意層的 AC 扣 8 | 「AC Then：'顯示訓練列表' 未精確化，應補：回傳 TrainingSession[]，含 id/date/status 欄位」 |
| AC 邊界覆蓋 | 20 | 每個 P0 動作缺錯誤狀態 AC 扣 6 | 「createTrainingSession 缺少 session 衝突時的錯誤 AC，請補 Given 已存在相同時段 When...」 |
| 命名一致性 | 10 | 每個與 Draft 不符的實體名稱扣 5 | 「Draft 用 TrainingSession，contract 用 Training，請統一」 |

**@FAIL 行為**: 局部修復 contract 失分維度後重評，不回退到 Draft 階段。
最多重試 2 次，第 2 次仍 @FAIL 則停止並回報使用者。

---

## POC.HTML 評分（門檻 75）

**觸發時機**: POC HTML 完成後，CYNEFIN-CHECK 前（Task-Pipe 路線）

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
