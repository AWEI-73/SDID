// AC Runner Edge Case 測試合約（AC ID 用 AC-9X.Y 格式避免與真實 AC 混淆）

// ─── CASE 1: 正常 PASS ────────────────────────────────────────
// @GEMS-AC: AC-91.0
// @GEMS-AC-FN: add
// @GEMS-AC-MODULE: utils/math
// @GEMS-AC-INPUT: [3, 4]
// @GEMS-AC-EXPECT: 7

// ─── CASE 2: 故意 FAIL（期望值錯誤）─────────────────────────────
// @GEMS-AC: AC-92.0
// @GEMS-AC-FN: add
// @GEMS-AC-MODULE: utils/math
// @GEMS-AC-INPUT: [3, 4]
// @GEMS-AC-EXPECT: 999

// ─── CASE 3: 函式拋出例外 ────────────────────────────────────────
// @GEMS-AC: AC-93.0
// @GEMS-AC-FN: divide
// @GEMS-AC-MODULE: utils/math
// @GEMS-AC-INPUT: [10, 0]
// @GEMS-AC-EXPECT: "should_throw"

// ─── CASE 4: 模組不存在 ──────────────────────────────────────────
// @GEMS-AC: AC-94.0
// @GEMS-AC-FN: add
// @GEMS-AC-MODULE: utils/nonexistent
// @GEMS-AC-INPUT: [1, 2]
// @GEMS-AC-EXPECT: 3

// ─── CASE 5: 函式不存在（模組存在但沒 export）───────────────────
// @GEMS-AC: AC-95.0
// @GEMS-AC-FN: multiply
// @GEMS-AC-MODULE: utils/math
// @GEMS-AC-INPUT: [3, 4]
// @GEMS-AC-EXPECT: 12

// ─── CASE 6: async 函式（應 SKIP）───────────────────────────────
// @GEMS-AC: AC-96.0
// @GEMS-AC-FN: fetchData
// @GEMS-AC-MODULE: utils/math
// @GEMS-AC-INPUT: ["test-id"]
// @GEMS-AC-EXPECT: {"id": "test-id"}

// ─── CASE 7: @GEMS-AC-FIELD partial match（目前 bug：FIELD 被忽略）
// @GEMS-AC: AC-97.0
// @GEMS-AC-FN: withExtra
// @GEMS-AC-MODULE: utils/math
// @GEMS-AC-INPUT: [5]
// @GEMS-AC-FIELD: value
// @GEMS-AC-EXPECT: {"value": 10, "meta": "internal"}

// ─── CASE 8: 缺少 @GEMS-AC-FN（應 SKIP）────────────────────────
// @GEMS-AC: AC-98.0
// @GEMS-AC-MODULE: utils/math
// @GEMS-AC-INPUT: [1, 2]
// @GEMS-AC-EXPECT: 3

// ─── CASE 9: INPUT JSON 格式錯誤（應 SKIP）──────────────────────
// @GEMS-AC: AC-99.0
// @GEMS-AC-FN: add
// @GEMS-AC-MODULE: utils/math
// @GEMS-AC-INPUT: [1, 2, broken json
// @GEMS-AC-EXPECT: 3
