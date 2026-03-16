// ─────────────────────────────────────────────────────────────────────────────
// ac-golden.ts — AC 驗收規格黃金樣板
// ─────────────────────────────────────────────────────────────────────────────
//
// 用途：
//   這是 contract_iter-N.ts 中 @GEMS-AC 區塊的填寫範例。
//   AI 在寫 contract.ts 時，參考此樣板填寫 @GEMS-AC 區塊。
//
// 定位：骨架確認 + happy path 不爆（不是品質保證）
//   - CYNEFIN 決定哪些 action needsTest: true
//   - ac-runner 為 needsTest: true 的 AC 生成 vitest test 檔
//   - vitest run → PASS/FAIL
//   - SKIP AC 不生成 test，直接跳過
//
// AC 只有兩種：
//   CALC — 純計算函式，ac-runner 生成 vitest test（needsTest:true）或直接執行（needsTest:false）
//   SKIP — 無法自動驗收（UI/人工），開發者自行負責
//
// Story-scope 規則（重要）：
//   ac-runner 用 @GEMS-STORY-ITEM 的最後一欄推導 AC→Story 映射。
//   --story=Story-X.Y 時只跑該 Story 的 AC。
//
// 支援的標籤：
//   @GEMS-AC:              AC ID（必填，格式 AC-X.Y）
//   @GEMS-AC-FN:           函式名稱（export 的函式名）
//   @GEMS-AC-MODULE:       相對於 src/ 的模組路徑（不含副檔名）
//   @GEMS-AC-SETUP:        前置步驟，JSON 陣列，每元素 {"fn":"fnName","module":"path","args":[...]}
//   @GEMS-AC-INPUT:        JSON 陣列，對應函式參數
//   @GEMS-AC-EXPECT:       JS 表達式（(result) => boolean）或 JSON 值
//   @GEMS-AC-EXPECT-THROW: Error 類別名稱（失敗路徑用）
//   @GEMS-AC-FIELD:        逗號分隔欄位名，只比對物件的指定欄位
//   @GEMS-AC-SKIP:         跳過原因（UI/人工/需外部 API-DB）
//
// ─────────────────────────────────────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════════════════════
// [CALC] 純計算函式 — 正常路徑
// ═══════════════════════════════════════════════════════════════════════════════

// 數值計算
// @GEMS-AC: AC-1.1
// @GEMS-AC-FN: calcCo2e
// @GEMS-AC-MODULE: shared/utils/calc-co2e
// @GEMS-AC-INPUT: [100, 0.502]
// @GEMS-AC-EXPECT: 50.2

// 邊界值：零輸入
// @GEMS-AC: AC-1.1b
// @GEMS-AC-FN: calcCo2e
// @GEMS-AC-MODULE: shared/utils/calc-co2e
// @GEMS-AC-INPUT: [0, 0.502]
// @GEMS-AC-EXPECT: 0

// 字串處理
// @GEMS-AC: AC-1.2
// @GEMS-AC-FN: formatCurrency
// @GEMS-AC-MODULE: shared/utils/format-currency
// @GEMS-AC-INPUT: [1234567.89, "TWD"]
// @GEMS-AC-EXPECT: "NT$1,234,567.89"

// 回傳物件（完整比對）
// @GEMS-AC: AC-1.3
// @GEMS-AC-FN: buildSummary
// @GEMS-AC-MODULE: modules/Report/lib/build-summary
// @GEMS-AC-INPUT: [{"total": 500, "count": 5}]
// @GEMS-AC-EXPECT: {"average": 100, "total": 500, "count": 5}

// 回傳物件（只驗關鍵欄位，忽略 timestamp 等動態欄位）
// @GEMS-AC: AC-1.4
// @GEMS-AC-FN: parseApiResponse
// @GEMS-AC-MODULE: shared/utils/parse-api-response
// @GEMS-AC-INPUT: [{"code": 200, "data": {"id": "abc"}, "timestamp": 1234567890}]
// @GEMS-AC-EXPECT: {"status": "ok", "code": 200}
// @GEMS-AC-FIELD: status, code

// 函式形式 expect（回傳值含不確定欄位，如 id）
// @GEMS-AC: AC-1.5
// @GEMS-AC-FN: addTransaction
// @GEMS-AC-MODULE: modules/Ledger/services/ledger-service
// @GEMS-AC-INPUT: [{"type": "EXPENSE", "amount": 100, "date": "2026-03-15"}]
// @GEMS-AC-EXPECT: (result) => result.id && result.id.length > 0


// ═══════════════════════════════════════════════════════════════════════════════
// [CALC] 有狀態流程 — 透過 SETUP 建立前置資料（needsTest: true → vitest orchestrator）
// ═══════════════════════════════════════════════════════════════════════════════

// [CALC] 有狀態流程 — 透過 SETUP 建立前置資料
// @GEMS-AC: AC-1.6
// @GEMS-AC-FN: getTransactions
// @GEMS-AC-MODULE: modules/Ledger/services/ledger-service
// @GEMS-AC-SETUP: [{"fn":"addTransaction","module":"modules/Ledger/services/ledger-service","args":[{"type":"EXPENSE","category":"餐飲","amount":100,"date":"2026-03-15"}]},{"fn":"addTransaction","module":"modules/Ledger/services/ledger-service","args":[{"type":"INCOME","category":"薪資","amount":5000,"date":"2026-03-01"}]},{"fn":"addTransaction","module":"modules/Ledger/services/ledger-service","args":[{"type":"EXPENSE","category":"交通","amount":50,"date":"2026-03-10"}]}]
// @GEMS-AC-INPUT: ["2026-03"]
// @GEMS-AC-EXPECT: (r) => r.length === 3 && r[0].date >= r[1].date


// ═══════════════════════════════════════════════════════════════════════════════
// [CALC] 失敗路徑 — 預期拋出 Error
// ═══════════════════════════════════════════════════════════════════════════════

// 輸入驗證：負數應拋出 RangeError
// @GEMS-AC: AC-2.1
// @GEMS-AC-FN: calcCo2e
// @GEMS-AC-MODULE: shared/utils/calc-co2e
// @GEMS-AC-INPUT: [-1, 0.5]
// @GEMS-AC-EXPECT-THROW: RangeError

// 業務規則：無效狀態轉換應拋出自訂 Error
// @GEMS-AC: AC-2.2
// @GEMS-AC-FN: transitionStatus
// @GEMS-AC-MODULE: modules/Order/lib/transition-status
// @GEMS-AC-INPUT: [{"status": "DELIVERED", "event": "PAYMENT_RECEIVED"}]
// @GEMS-AC-EXPECT-THROW: InvalidTransitionError


// ═══════════════════════════════════════════════════════════════════════════════
// [SKIP] 無法自動驗收 — 開發者自行負責
// ═══════════════════════════════════════════════════════════════════════════════

// 有狀態流程但前置無法本地建立（需外部 API/DB）
// @GEMS-AC: AC-3.1
// @GEMS-AC-SKIP: 需要外部 API/DB，無法本地跑，開發者自行驗收

// DB 查詢（有外部依賴）
// @GEMS-AC: AC-3.2
// @GEMS-AC-SKIP: 需要 DB 連線，開發者自行驗收

// UI 互動
// @GEMS-AC: AC-3.3
// @GEMS-AC-SKIP: UI 互動，人工 POC 驗收

// React Hook
// @GEMS-AC: AC-3.4
// @GEMS-AC-SKIP: React Hook，靠 POC.html 人工確認


// ─────────────────────────────────────────────────────────────────────────────
// 填寫決策樹：
//
//   函式有 side effect 或需要前置狀態？
//     ├─ 需要前置狀態但前置狀態可用 production function 建立 → CALC with SETUP
//     │     → ac-runner 生成 vitest test，SETUP 步驟在 beforeEach 內執行
//     ├─ 需要外部 API/DB（無法本地跑） → SKIP（開發者自行驗收）
//     └─ 無狀態（純計算）→ CALC with INPUT+EXPECT
//         ├─ 預期拋出 Error？→ 用 EXPECT-THROW
//         ├─ 回傳物件只驗部分欄位？→ 加 FIELD
//         ├─ 回傳值含不確定欄位（如 id）？→ 用 (result) => boolean 表達式
//         └─ 其他 → 直接填 EXPECT
// ─────────────────────────────────────────────────────────────────────────────
