#!/usr/bin/env node
/**
 * STUB-001 空骨架偵測邏輯測試
 *
 * 複製 phase-2.cjs 中的 STUB_PATTERNS + effectiveLines 偵測邏輯進行單元測試
 * 不 require phase-2（避免 CLI 副作用）
 *
 * v2: 改用 effectiveLines（去掉所有註解 + 函式簽名 + 右括號），
 *     修復 STEP 灌水逃脫問題（size 門檻從 5 提升至 15）
 */

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

// ============================================
// 複製 phase-2 的偵測邏輯（保持與實作同步）
// ============================================
const STUB_PATTERNS = [
  /^\s*return\s*\[\s*\]\s*[;,]?\s*$/m,
  /^\s*return\s*\{\s*\}\s*[;,]?\s*$/m,
  /^\s*return\s*null\s*[;,]?\s*$/m,
  /^\s*return\s*undefined\s*[;,]?\s*$/m,
  /^\s*\/\/\s*TODO/mi,
  /throw\s+new\s+Error\s*\(\s*['"`]not\s+implemented/mi,
  /throw\s+new\s+Error\s*\(\s*['"`]stub/mi,
];

/**
 * effectiveLines: 去掉所有註解、函式簽名、右括號，只留真實邏輯行
 * 與 phase-2.cjs STUB-001 的 effectiveLines 邏輯保持同步
 */
function getEffectiveLines(fnBody) {
  return fnBody.split('\n').filter(l => {
    const t = l.trim();
    if (!t) return false;
    if (/^\s*\/\//.test(l)) return false;                     // 所有註解（含 STEP、TODO）
    if (/^\s*\/\*/.test(l) || /^\s*\*/.test(l)) return false; // block 註解
    if (/^\s*(export\s+)?(async\s+)?function\s/.test(l)) return false; // 函式簽名
    if (/^\s*\}\s*$/.test(l)) return false;                   // 右括號
    return true;
  });
}

function isStubBody(fnBody) {
  const effectiveLines = getEffectiveLines(fnBody);
  if (effectiveLines.length > 2) return false;
  return STUB_PATTERNS.some(p => p.test(fnBody)) || effectiveLines.length <= 1;
}

// ============================================
// 測試案例
// ============================================

console.log('\n=== STUB-001 空骨架偵測測試 (v2 — effectiveLines) ===\n');

// --- 該抓的 (stub) ---

console.log('Case 1: return [] → STUB');
assert(isStubBody(`
  // [STEP:1] FETCH_GROUPS
  return []
`), 'return [] 偵測為 stub');

console.log('\nCase 2: return {} → STUB');
assert(isStubBody(`
  // [STEP:1] INIT
  return {}
`), 'return {} 偵測為 stub');

console.log('\nCase 3: // TODO → STUB');
assert(isStubBody(`
  // TODO: implement this
  return null
`), '// TODO 偵測為 stub');

console.log('\nCase 4: throw new Error("not implemented") → STUB');
assert(isStubBody(`
  throw new Error('not implemented')
`), 'throw not implemented 偵測為 stub');

console.log('\nCase 7: 只有 GEMS 標籤，無實作 → STUB');
assert(isStubBody(`
  // [STEP:1] ANALYZE
  // [STEP:2] RETURN_RESULT
`), '只有標籤行偵測為 stub');

console.log('\nCase 8: return null → STUB');
assert(isStubBody(`
  // [STEP:1] FIND_USER
  return null;
`), 'return null 偵測為 stub');

console.log('\nCase 9: throw new Error("stub") → STUB');
assert(isStubBody(`
  throw new Error('stub')
`), 'throw stub 偵測為 stub');

// --- v2 新增: STEP 灌水案例 ---

console.log('\nCase 11: STEP 灌水 + TODO（v2 新增 — 舊版漏掉） → STUB');
assert(isStubBody(`export function RealStub(): void {
  // [STEP] Init
  // [STEP] Process
  // [STEP] Validate
  // [STEP] Transform
  // [STEP] Save
  // [STEP] Return
  // TODO: implement later
}`), 'STEP 灌水 + TODO 偵測為 stub');

console.log('\nCase 12: STEP 灌水 + return []（v2 新增 — 舊版漏掉） → STUB');
assert(isStubBody(`export function PaddedStub(): any[] {
  // [STEP] Fetch
  // [STEP] Parse
  // [STEP] Transform
  // [STEP] Return
  return [];
}`), 'STEP 灌水 + return [] 偵測為 stub');

console.log('\nCase 13: 函式簽名 + 只有 STEP（v2 新增） → STUB');
assert(isStubBody(`export function OnlySteps(): void {
  // [STEP] Step1
  // [STEP] Step2
  // [STEP] Step3
}`), '函式簽名 + 只有 STEP 偵測為 stub');

// --- 不該抓的 (有真實邏輯) ---

console.log('\nCase 5: 真實短邏輯 → NOT STUB');
assert(!isStubBody(`
  // [STEP:1] PARSE_REGEX
  const match = text.match(/\\d+/g);
  return match ? match[0] : null;
`), '真實邏輯不誤判為 stub');

console.log('\nCase 6: 多行真實實作 → NOT STUB');
assert(!isStubBody(`
  // [STEP:1] CALC_SCORE
  const total = answers.reduce((sum, a) => sum + (a.correct ? 1 : 0), 0);
  const score = Math.round((total / answers.length) * 100);
  return { total, score, passed: score >= 60 };
`), '多行實作不誤判為 stub');

console.log('\nCase 10: 多行有效行（const 賦值有業務語意） → NOT STUB');
assert(!isStubBody(`
  // [STEP:1]
  const a = 1;
  const b = 2;
  const c = 3;
  return a + b + c;
`), '多行 const 賦值不誤判為 stub');

console.log('\nCase 14: ANTIGRAVITY 例子（const 有真實欄位名） → NOT STUB');
assert(!isStubBody(`export function ExtractorInterfaces(): string[] {
  // [STEP] DefineMetadata
  const metaFields = ['dataUrl', 'symId', 'x', 'y', 'w', 'h'];
  // [STEP] UpdateExtractedPage
  const pageFields = ['paging', 'categories'];
  // [STEP] UpdateParsedQuestion
  const questionFields = ['stemImgs', 'metadata'];
  return [...metaFields, ...pageFields, ...questionFields];
}`), 'ANTIGRAVITY 例子（有真實 const 賦值）不誤判為 stub');

console.log('\nCase 15: 真實 async 業務邏輯 → NOT STUB');
assert(!isStubBody(`export async function fetchUser(id: string): Promise<User> {
  // [STEP] Validate
  if (!id) throw new Error('id required');
  // [STEP] Fetch
  const user = await db.users.findById(id);
  if (!user) throw new Error('not found');
  // [STEP] Transform
  return mapToDto(user);
}`), '真實 async 業務邏輯不誤判為 stub');

// ============================================
// 結果
// ============================================
console.log(`\n${'='.repeat(40)}`);
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('❌ 有測試失敗');
  process.exit(1);
} else {
  console.log('✅ 全部通過');
  process.exit(0);
}
