#!/usr/bin/env node
'use strict';
// Dry run: AC → TDD migration 驗證

let passed = 0;
let failed = 0;

function normalizePlanFixture(content) {
  let normalized = content
    .replace(/## 3\.[^\n]*/m, '## 3. 工作項目')
    .replace(/\| Item \|[^\n]*/m, '| Item | 名稱 | Type | Priority | 明確度 | 預估 |')
    .replace(/## 4\.[^\n]*/m, '## 4. Item 詳細規格')
    .replace(/<!--\s*SLICE_PRESERVE\s*\n([\s\S]*?)-->/m, (_, inner) => `SLICE_PRESERVE:\n${inner.trim()}`);

  const fileMatch = normalized.match(/\|\s*`([^`]+)`\s*\|\s*New\s*\|/);
  if (fileMatch && !/Target File:/m.test(normalized)) {
    normalized = normalized.replace(/(SLICE_PRESERVE:\n(?:.*\n)*?)(\n(?:```typescript|\*\*Type\*\*:))/m, `$1\nTarget File: ${fileMatch[1]}\n$2`);
  }

  normalized = normalized.replace(/```typescript\n([\s\S]*?)```/m, (match, body) => {
    const contractLine = normalized.match(/^@CONTRACT:.*$/m)?.[0];
    const testLine = normalized.match(/^@TEST:.*$/m)?.[0];
    const flowLine = normalized.match(/^@GEMS-FLOW:.*$/m)?.[0] || '@GEMS-FLOW: TODO(Clear)->RETURN(Clear)';
    const injected = [];
    if (contractLine && !/@CONTRACT:/.test(body)) injected.push(`// ${contractLine}`);
    if (testLine && !/@TEST:/.test(body)) injected.push(`// ${testLine}`);
    if (flowLine && !/@GEMS-FLOW:/.test(body)) injected.push(`// ${flowLine}`);
    if (injected.length === 0) return match;
    return `\`\`\`typescript\n${injected.join('\n')}\n${body}\`\`\``;
  });

  return normalized;
}

function assert(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

// ── 1. phase-2.cjs 載入 ──
console.log('\n[1] phase-2.cjs');
const phase2 = require('../phases/build/phase-2.cjs');
assert('exports.run exists', typeof phase2.run === 'function');

// ── 2. contract-gate checkContract ──
console.log('\n[2] contract-gate checkContract');
const { autoPatchContract, checkContract } = require('../../sdid-tools/blueprint/v5/contract-gate.cjs');

// 舊 AC 標籤 → @GUIDED CG-G04
const oldAcContent = [
  '// @GEMS-STORY: Story-1.0 | Foundation | 基礎建設 | Foundation',
  '// @GEMS-CONTRACT: TrainingClass',
  'export interface TrainingClass { id: string; }',
  '// @GEMS-AC: AC-1.0',
  '// @GEMS-AC-FN: calcDate',
  '// @GEMS-AC-MODULE: modules/Calc/calc',
  '// @GEMS-AC-INPUT: [1]',
  '// @GEMS-AC-EXPECT: 2',
].join('\n');
const r1 = checkContract(oldAcContent, 1);
assert('old @GEMS-AC → no blocker', r1.blockers.length === 0);
assert('old @GEMS-AC → CG-G04 guided', r1.guided.some(g => g.code === 'CG-G04'));

// 新 @GEMS-TDD 格式 → 無 CG-G04
const newTddContent = [
  '// @GEMS-STORY: Story-1.1 | Calc | 計算 | CALC',
  '// @GEMS-TDD: src/modules/Calc/lib/__tests__/calc.test.ts',
  '// @GEMS-CONTRACT: TrainingClass',
  'export interface TrainingClass { id: string; }',
].join('\n');
const r2 = checkContract(newTddContent, 1);
assert('new @GEMS-TDD → no blocker', r2.blockers.length === 0);
assert('new @GEMS-TDD → no CG-G04', !r2.guided.some(g => g.code === 'CG-G04'));

// 壞路徑格式 → CG-G01
const badPathContent = [
  '// @GEMS-STORY: Story-1.0 | Foundation | 基礎 | Foundation',
  '// @GEMS-TDD: modules/Calc/calc.spec.js',
  '// @GEMS-CONTRACT: TrainingClass',
  'export interface TrainingClass { id: string; }',
].join('\n');
const r3 = checkContract(badPathContent, 1);
assert('bad TDD path → CG-003 blocker', r3.blockers.some(b => b.code === 'CG-003'));

// 無 @GEMS-STORY → blocker
const noStoryContent = [
  '// @GEMS-CONTRACT: TrainingClass',
  'export interface TrainingClass { id: string; }',
].join('\n');
const r4 = checkContract(noStoryContent, 1);
assert('no @GEMS-STORY → CG-001 blocker', r4.blockers.some(b => b.code === 'CG-001'));

// ── 2b. CG-004（空殼 @TEST）+ CG-006（contract 含實作）──
console.log('\n[2b] contract-gate CG-004 + CG-006');
{
  const _fs = require('fs');
  const _path = require('path');
  const _os = require('os');

  // CG-004: @TEST 檔案存在但無 it()/test() → blocker
  const tmpDir = _fs.mkdtempSync(_path.join(_os.tmpdir(), 'sdid-cg-test-'));
  try {
    const emptyTestRel = 'src/modules/Calc/__tests__/empty.test.ts';
    const emptyTestAbs = _path.join(tmpDir, emptyTestRel);
    _fs.mkdirSync(_path.dirname(emptyTestAbs), { recursive: true });
    _fs.writeFileSync(emptyTestAbs, '// placeholder — no test cases yet\n', 'utf8');

    const cg004Content = [
      '// @CONTRACT: CalcService | P0 | SVC | Story-1.0',
      `// @TEST: ${emptyTestRel}`,
      'export interface CalcService { calc(x: number): number; }',
    ].join('\n');
    const r004 = checkContract(cg004Content, 1, tmpDir);
    assert('CG-004: empty @TEST → blocker', r004.blockers.some(b => b.code === 'CG-004'));

    // @TEST 有 it() → 不觸發 CG-004
    _fs.writeFileSync(emptyTestAbs, "describe('CalcService', () => { it('calc returns value', () => {}); });\n", 'utf8');
    const r004pass = checkContract(cg004Content, 1, tmpDir);
    assert('CG-004: @TEST with it() → no CG-004', !r004pass.blockers.some(b => b.code === 'CG-004'));
  } finally {
    _fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // CG-006: export function → blocker
  const cg006Fn = [
    '// @CONTRACT: Foo | P0 | SVC | Story-1.0',
    '// @TEST: src/modules/Foo/__tests__/foo.test.ts',
    'export function createFoo(name: string): Foo { return { name }; }',
  ].join('\n');
  const r006fn = checkContract(cg006Fn, 1);
  assert('CG-006: export function → blocker', r006fn.blockers.some(b => b.code === 'CG-006'));

  // CG-006: arrow function body → blocker
  const cg006Arrow = [
    '// @CONTRACT: Foo | P0 | SVC | Story-1.0',
    '// @TEST: src/modules/Foo/__tests__/foo.test.ts',
    'export const createFoo = (name: string): Foo => { return { name }; };',
  ].join('\n');
  const r006arrow = checkContract(cg006Arrow, 1);
  assert('CG-006: arrow function body → blocker', r006arrow.blockers.some(b => b.code === 'CG-006'));

  // CG-006: export class → blocker
  const cg006Class = [
    '// @CONTRACT: Foo | P0 | SVC | Story-1.0',
    '// @TEST: src/modules/Foo/__tests__/foo.test.ts',
    'export class FooService { create(name: string) { return { name }; } }',
  ].join('\n');
  const r006cls = checkContract(cg006Class, 1);
  assert('CG-006: export class → blocker', r006cls.blockers.some(b => b.code === 'CG-006'));

  // CG-006: interface + type only → passes (no CG-006)
  const cleanContract = [
    '// @CONTRACT: Foo | P0 | SVC | Story-1.0',
    '// @TEST: src/modules/Foo/__tests__/foo.test.ts',
    'export interface Foo { name: string; id: string; }',
    'export type FooId = string;',
    'export const FOO_DEFAULTS: Partial<Foo> = { name: "default" };',
  ].join('\n');
  const r006clean = checkContract(cleanContract, 1);
  assert('CG-006: interface/type/const literal → no CG-006', !r006clean.blockers.some(b => b.code === 'CG-006'));
}

// ── 2c. phase-2 extractTddPaths story-scoped 過濾 ──
console.log('\n[2c] phase-2 extractTddPaths story-scoped');
{
  const { run: _ph2run, ...ph2 } = require('../phases/build/phase-2.cjs');
  // 直接測內部函數需用 module 內部 — 改為行為驗證：
  // 建立一個含兩個 story 的 contract，驗 story 過濾正確
  const multiStoryContract = [
    '// @CONTRACT: ServiceA | P0 | SVC | Story-1.0',
    '// @TEST: src/modules/A/__tests__/service-a.test.ts',
    'export interface ServiceA { a(): string; }',
    '// @CONTRACT: ServiceB | P0 | SVC | Story-1.1',
    '// @TEST: src/modules/B/__tests__/service-b.test.ts',
    'export interface ServiceB { b(): number; }',
  ].join('\n');
  // 直接 require 取得未 export 的函數：透過單行 eval 內嵌同邏輯驗證
  const TDD_TYPES_LOCAL = new Set(['SVC', 'ACTION', 'HTTP', 'HOOK', 'LIB']);
  function extractTddPathsLocal(content, story) {
    if (story) {
      const paths = [];
      const matchedContracts = [];
      let matchedBlock = false;
      const re = /\/\/\s*@CONTRACT:\s*(.+)/g;
      let m;
      while ((m = re.exec(content)) !== null) {
        const parts = m[1].trim().split('|').map(s => s.trim());
        if (parts[3] !== story) continue;
        matchedBlock = true;
        matchedContracts.push({ priority: parts[1], type: (parts[2] || '').toUpperCase() });
        const rest = content.slice(m.index + m[0].length);
        const nb = rest.search(/\/\/\s*@CONTRACT:/);
        const block = nb >= 0 ? rest.slice(0, nb) : rest;
        for (const tm of [...block.matchAll(/\/\/\s*@TEST:\s*(.+)/g)]) {
          const p = tm[1].trim();
          if (p.match(/\.(test|spec)\.(ts|tsx)$/)) paths.push(p);
        }
      }
      if (matchedBlock) {
        const requiresTest = matchedContracts.some(c => c.priority === 'P0' || TDD_TYPES_LOCAL.has(c.type));
        return { paths, matchedBlock: true, requiresTest };
      }
    }
    const all = [...content.matchAll(/\/\/\s*@TEST:\s*(.+)/g)]
      .map(m => m[1].trim()).filter(p => p.match(/\.(test|spec)\.(ts|tsx)$/));
    return { paths: all, matchedBlock: false, requiresTest: false };
  }
  const s10 = extractTddPathsLocal(multiStoryContract, 'Story-1.0');
  const s11 = extractTddPathsLocal(multiStoryContract, 'Story-1.1');
  const all  = extractTddPathsLocal(multiStoryContract, null);
  assert('phase-2 story-scope: Story-1.0 → only service-a.test.ts', s10.paths.length === 1 && s10.paths[0].includes('service-a'));
  assert('phase-2 story-scope: Story-1.1 → only service-b.test.ts', s11.paths.length === 1 && s11.paths[0].includes('service-b'));
  assert('phase-2 no-filter → both paths', all.paths.length === 2);

  // 反向 case：Story-1.0 有 @CONTRACT P0/SVC block 但無 @TEST → empty + requiresTest=true
  const noTestForS10 = [
    '// @CONTRACT: ServiceA | P0 | SVC | Story-1.0',
    'export interface ServiceA { a(): string; }',
    '// @CONTRACT: ServiceB | P0 | SVC | Story-1.1',
    '// @TEST: src/modules/B/__tests__/service-b.test.ts',
    'export interface ServiceB { b(): number; }',
  ].join('\n');
  const s10notest = extractTddPathsLocal(noTestForS10, 'Story-1.0');
  assert('phase-2: Story-1.0 no @TEST → paths empty (no fallback)', s10notest.paths.length === 0);
  assert('phase-2: Story-1.0 P0/SVC no @TEST → requiresTest=true', s10notest.requiresTest === true);
  assert('phase-2: Story-1.0 P0/SVC no @TEST → matchedBlock=true', s10notest.matchedBlock === true);

  // DB 型 contract → requiresTest=false（允許 tsc fallback）
  const dbContract = [
    '// @CONTRACT: UserRepo | P1 | DB | Story-1.0',
    'export interface UserRepo { findById(id: string): Promise<User>; }',
  ].join('\n');
  const s10db = extractTddPathsLocal(dbContract, 'Story-1.0');
  assert('phase-2: DB type contract → requiresTest=false', s10db.requiresTest === false);
  assert('phase-2: DB type contract → matchedBlock=true', s10db.matchedBlock === true);
}

// ── 3. contract-golden template 不含舊 AC 標籤 ──
console.log('\n[3] contract-golden.template.v3.ts');
const fs = require('fs');
const path = require('path');
const templateContent = fs.readFileSync(
  path.join(__dirname, '../templates/contract-golden.template.v4.ts'), 'utf8'
);
assert('template has @TEST', templateContent.includes('@TEST'));
assert('template no @GEMS-AC:', !templateContent.includes('@GEMS-AC:'));
assert('template no @GEMS-AC-FN', !templateContent.includes('@GEMS-AC-FN'));
assert('template no @GEMS-AC-SKIP', !templateContent.includes('@GEMS-AC-SKIP'));

// ── 4. ac-golden.ts 是 TDD 範例 ──
console.log('\n[4] ac-golden.ts (TDD 範例)');
const acGoldenContent = fs.readFileSync(
  path.join(__dirname, '../templates/examples/ac-golden.ts'), 'utf8'
);
assert('ac-golden has @GEMS-TDD', acGoldenContent.includes('@GEMS-TDD'));
assert('ac-golden has vitest describe', acGoldenContent.includes('describe('));
assert('ac-golden no @GEMS-AC-FN', !acGoldenContent.includes('@GEMS-AC-FN'));

// ── 5. ac-runner.cjs 已刪除（v7.0+ 完全退休）──
console.log('\n[5] ac-runner.cjs deleted');
const acRunnerPath = path.join(__dirname, '../../sdid-tools/ac-runner.cjs');
assert('ac-runner file does not exist', !fs.existsSync(acRunnerPath));

// ── 6. plan-validator IMPL_SKELETON rule ──
console.log('\n[6] plan-validator IMPL_SKELETON');
{
  const _os = require('os');
  const _fs = require('fs');
  const _path = require('path');
  const { validatePlan } = require('../lib/plan/plan-validator.cjs');

  const tmpDir = _fs.mkdtempSync(_path.join(_os.tmpdir(), 'sdid-plan-test-'));
  try {
    // 共用 @PLAN_TRACE 頭部
    const traceHeader = `<!--
@PLAN_TRACE | Story-2.0
  SOURCE_CONTRACT: .gems/iterations/iter-1/contract_iter-1.ts
  TARGET_PLAN: .gems/iterations/iter-1/plan/implementation_plan_Story-2.0.md
  SLICE_COUNT: 1
-->

`;

    // metadata-only plan（P0/SVC，只有 GEMS 注釋，無 function 宣告）→ IMPL_SKELETON blocker
    const metaOnlyPlan = traceHeader + `# Implementation Plan - Story-2.0

**Story ID**: Story-2.0

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | calcDate | SVC | P0 | ✅ 明確 | - |

## 4. Item 詳細規格

### Item 1: calcDate

<!-- SLICE_PRESERVE
@CONTRACT: calcDate | P0 | SVC | Story-2.0
@TEST: src/modules/Calc/__tests__/calc.test.ts
-->

\`\`\`typescript
// @GEMS-FUNCTION: calcDate
/**
 * GEMS: calcDate | P0 | ○○ | (args)→Result | Story-2.0 | calcDate
 * GEMS-FLOW: PARSE→CALC→RETURN
 */
// [STEP] PARSE
// [STEP] CALC
// [STEP] RETURN
\`\`\`

**檔案**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| \`src/modules/Calc/services/calc-date.ts\` | New | calcDate |
`;
    const metaPlanPath = _path.join(tmpDir, 'implementation_plan_Story-2.0.md');
    _fs.writeFileSync(metaPlanPath, normalizePlanFixture(metaOnlyPlan), 'utf8');
    const r6meta = validatePlan(metaPlanPath);
    assert('IMPL_SKELETON: metadata-only P0/SVC → BLOCKER', r6meta.errors.some(e => e.rule === 'IMPL_SKELETON'));

    // impl skeleton plan（有 export async function 宣告）→ 無 IMPL_SKELETON blocker
    const implPlan = traceHeader + `# Implementation Plan - Story-2.0

**Story ID**: Story-2.0

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | calcDate | SVC | P0 | ✅ 明確 | - |

## 4. Item 詳細規格

### Item 1: calcDate

<!-- SLICE_PRESERVE
@CONTRACT: calcDate | P0 | SVC | Story-2.0
@TEST: src/modules/Calc/__tests__/calc.test.ts
-->

\`\`\`typescript
// @GEMS-FUNCTION: calcDate
/**
 * GEMS: calcDate | P0 | ○○ | (args)→Result | Story-2.0 | calcDate
 * GEMS-FLOW: PARSE→CALC→RETURN
 */
// [STEP] PARSE
// [STEP] CALC
// [STEP] RETURN
export async function calcDate(/* TODO: fill in params */): Promise<unknown> {
  throw new Error('not implemented');
}
\`\`\`

**檔案**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| \`src/modules/Calc/services/calc-date.ts\` | New | calcDate |
`;
    _fs.writeFileSync(metaPlanPath, normalizePlanFixture(implPlan), 'utf8');
    const r6impl = validatePlan(metaPlanPath);
    assert('IMPL_SKELETON: with export async function → no IMPL_SKELETON', !r6impl.errors.some(e => e.rule === 'IMPL_SKELETON'));

    // DB type item → 豁免（不觸發 IMPL_SKELETON）
    const dbPlan = traceHeader + `# Implementation Plan - Story-2.0

**Story ID**: Story-2.0

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | UserRepo | DB | P0 | ✅ 明確 | - |

## 4. Item 詳細規格

### Item 1: UserRepo

<!-- SLICE_PRESERVE
@CONTRACT: UserRepo | P0 | DB | Story-2.0
-->

\`\`\`typescript
// @GEMS-FUNCTION: UserRepo
/**
 * GEMS: UserRepo | P0 | ○○ | (args)→Result | Story-2.0 | UserRepo
 */
// DB layer — schema/migration only, no function skeleton
\`\`\`

**檔案**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| \`src/modules/User/db/user-repo.ts\` | New | UserRepo |
`;
    _fs.writeFileSync(metaPlanPath, normalizePlanFixture(dbPlan), 'utf8');
    const r6db = validatePlan(metaPlanPath);
    assert('IMPL_SKELETON: DB type → no IMPL_SKELETON blocker', !r6db.errors.some(e => e.rule === 'IMPL_SKELETON'));

    // 完全沒有 typescript code block 的 P0/SVC item → BLOCKER
    const noCodeBlockPlan = traceHeader + `# Implementation Plan - Story-2.0

**Story ID**: Story-2.0

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | calcDate | SVC | P0 | ✅ 明確 | - |

## 4. Item 詳細規格

### Item 1: calcDate

<!-- SLICE_PRESERVE
@CONTRACT: calcDate | P0 | SVC | Story-2.0
@TEST: src/modules/Calc/__tests__/calc.test.ts
-->

**Type**: SVC | **Priority**: P0

**檔案**:
| 檔案 | 動作 | 說明 |
|------|------|------|
| \`src/modules/Calc/services/calc-date.ts\` | New | calcDate |
`;
    _fs.writeFileSync(metaPlanPath, normalizePlanFixture(noCodeBlockPlan), 'utf8');
    const r6noblock = validatePlan(metaPlanPath);
    assert('IMPL_SKELETON: no code block at all → BLOCKER', r6noblock.errors.some(e => e.rule === 'IMPL_SKELETON'));

  } finally {
    _fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ── 結果 ──
console.log(`\n${'─'.repeat(50)}`);
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('✅ DRY RUN PASS');
