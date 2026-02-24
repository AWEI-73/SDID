#!/usr/bin/env node
/**
 * STUB-001 空骨架偵測邏輯測試
 *
 * 複製 phase-2.cjs 中的 STUB_PATTERNS + size 偵測邏輯進行單元測試
 * 不 require phase-2（避免 CLI 副作用）
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

function isStubBody(fnBody) {
  const nonTagLines = fnBody.split('\n').filter(l =>
    l.trim() && !/^\s*\/\/\s*\[STEP/.test(l) && !/^\s*\/\*/.test(l) && !/^\s*\*/.test(l)
  );
  if (nonTagLines.length > 2) return false; // 超過 2 個有效行，不是 stub
  return STUB_PATTERNS.some(p => p.test(fnBody)) || nonTagLines.length <= 1;
}

// ============================================
// 測試案例
// ============================================

console.log('\n=== STUB-001 空骨架偵測測試 ===\n');

// Case 1: return [] 是 stub
console.log('Case 1: return [] → STUB');
assert(isStubBody(`
  // [STEP:1] FETCH_GROUPS
  return []
`), 'return [] 偵測為 stub');

// Case 2: return {} 是 stub
console.log('\nCase 2: return {} → STUB');
assert(isStubBody(`
  // [STEP:1] INIT
  return {}
`), 'return {} 偵測為 stub');

// Case 3: // TODO 是 stub
console.log('\nCase 3: // TODO → STUB');
assert(isStubBody(`
  // TODO: implement this
  return null
`), '// TODO 偵測為 stub');

// Case 4: throw new Error('not implemented') 是 stub
console.log('\nCase 4: throw new Error("not implemented") → STUB');
assert(isStubBody(`
  throw new Error('not implemented')
`), 'throw not implemented 偵測為 stub');

// Case 5: 真實 regex 邏輯，雖然短，但不是 stub
console.log('\nCase 5: 真實短邏輯 → NOT STUB');
assert(!isStubBody(`
  // [STEP:1] PARSE_REGEX
  const match = text.match(/\\d+/g);
  return match ? match[0] : null;
`), '真實邏輯不誤判為 stub');

// Case 6: 多行真實實作 → NOT STUB
console.log('\nCase 6: 多行真實實作 → NOT STUB');
assert(!isStubBody(`
  // [STEP:1] CALC_SCORE
  const total = answers.reduce((sum, a) => sum + (a.correct ? 1 : 0), 0);
  const score = Math.round((total / answers.length) * 100);
  return { total, score, passed: score >= 60 };
`), '多行實作不誤判為 stub');

// Case 7: 只有 GEMS 標籤行，沒有任何實作 → STUB
console.log('\nCase 7: 只有 GEMS 標籤，無實作 → STUB');
assert(isStubBody(`
  // [STEP:1] ANALYZE
  // [STEP:2] RETURN_RESULT
`), '只有標籤行偵測為 stub');

// Case 8: return null（合理的空實作）→ STUB
console.log('\nCase 8: return null → STUB');
assert(isStubBody(`
  // [STEP:1] FIND_USER
  return null;
`), 'return null 偵測為 stub');

// Case 9: throw new Error('stub') → STUB
console.log('\nCase 9: throw new Error("stub") → STUB');
assert(isStubBody(`
  throw new Error('stub')
`), 'throw stub 偵測為 stub');

// Case 10: size > 5 行的函式不進入偵測（規則：size > 5 跳過）
console.log('\nCase 10: size > 5 行的函式不進入偵測');
const bigFnBody = `
  // [STEP:1]
  const a = 1;
  const b = 2;
  const c = 3;
  return a + b + c;
`;
// size > 5 的話直接跳過，這個測試確認邏輯本身不誤判
assert(!isStubBody(bigFnBody), 'size > 5 的函式邏輯不誤判（獨立於 size 過濾）');

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
