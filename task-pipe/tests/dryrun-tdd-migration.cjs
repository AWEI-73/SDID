#!/usr/bin/env node
'use strict';
// Dry run: AC → TDD migration 驗證

let passed = 0;
let failed = 0;

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
assert('bad TDD path → CG-G01 guided', r3.guided.some(g => g.code === 'CG-G01'));

// 無 @GEMS-STORY → blocker
const noStoryContent = [
  '// @GEMS-CONTRACT: TrainingClass',
  'export interface TrainingClass { id: string; }',
].join('\n');
const r4 = checkContract(noStoryContent, 1);
assert('no @GEMS-STORY → CG-001 blocker', r4.blockers.some(b => b.code === 'CG-001'));

// ── 3. contract-golden template 不含舊 AC 標籤 ──
console.log('\n[3] contract-golden.template.v3.ts');
const fs = require('fs');
const path = require('path');
const templateContent = fs.readFileSync(
  path.join(__dirname, '../templates/contract-golden.template.v3.ts'), 'utf8'
);
assert('template has @GEMS-TDD', templateContent.includes('@GEMS-TDD'));
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

// ── 5. ac-runner.cjs 有 deprecated 標頭 ──
console.log('\n[5] ac-runner.cjs deprecated');
const acRunnerContent = fs.readFileSync(
  path.join(__dirname, '../../sdid-tools/ac-runner.cjs'), 'utf8'
);
assert('ac-runner has @deprecated', acRunnerContent.includes('@deprecated'));
assert('ac-runner deprecated mentions v7.0', acRunnerContent.includes('v7.0'));

// ── 結果 ──
console.log(`\n${'─'.repeat(50)}`);
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('✅ DRY RUN PASS');
