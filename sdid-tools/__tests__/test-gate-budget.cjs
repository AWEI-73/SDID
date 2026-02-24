#!/usr/bin/env node
/**
 * Test: Blueprint Gate BUDGET-001/002 + VSC-003
 *
 * 測試 blueprint-gate.cjs 的兩個新檢查：
 *   checkIterActionBudget() — BUDGET-001 (超標 BLOCKER) + BUDGET-002 (到限 WARN)
 *   checkVerticalSliceCompleteness() VSC-003 — delivery=BACKEND/FRONTEND 時 BLOCKER
 *
 * 測試案例:
 *   Case 1: Level M, iter-2 有 5 個動作 → BUDGET-001 BLOCKER (上限 4)
 *   Case 2: Level M, iter-2 有 4 個動作 → BUDGET-002 WARN (剛好到限)
 *   Case 3: Level M, iter-2 有 3 個動作 → PASS (未達上限)
 *   Case 4: Foundation iter-1（全 CONST/LIB），5 個動作 → 豁免，PASS
 *   Case 5: delivery = BACKEND → VSC-003 BLOCKER
 *   Case 6: delivery = FULL → VSC-003 不觸發
 */

'use strict';

const gate = require('../blueprint-gate.cjs');

let pass = 0;
let fail = 0;

function assert(condition, msg) {
  if (condition) {
    pass++;
    console.log('  ✅ ' + msg);
  } else {
    fail++;
    console.log('  ❌ ' + msg);
  }
}

// ============================================================
// Helper: 建立最小化的 draft 物件
// ============================================================
function makeDraft({ level = 'M', iterationPlan = [], moduleActions = {} } = {}) {
  return {
    level,
    iterationPlan,
    moduleActions,
    // 其他必要欄位填空
    goal: '測試目標',
    groups: [],
    entities: {},
    sharedModules: [],
    modules: {},
    features: [],
    exclusions: [],
  };
}

// ============================================================
// Case 1: Level M, iter-2 有 5 個動作 → BUDGET-001 BLOCKER
// ============================================================
console.log('\n=== Case 1: Level M, iter-2 有 5 個動作 → BUDGET-001 BLOCKER ===');
{
  const draft = makeDraft({
    level: 'M',
    iterationPlan: [
      { iter: 1, module: 'shared', delivery: 'INFRA', status: '[CURRENT]', goal: '', deps: [] },
      { iter: 2, module: 'question_bank', delivery: 'FULL', status: '[STUB]', goal: '', deps: [] },
    ],
    moduleActions: {
      question_bank: {
        iter: 2,
        fillLevel: 'current',
        items: [
          { type: 'SVC',   techName: 'QuestionBankService', priority: 'P0', flow: 'A→B', deps: [] },
          { type: 'UI',    techName: 'QuestionBankList',    priority: 'P1', flow: 'A→B', deps: [] },
          { type: 'ROUTE', techName: 'QuestionBankPage',    priority: 'P1', flow: 'A→B', deps: [] },
          { type: 'SVC',   techName: 'PdfParseCoordinator', priority: 'P0', flow: 'A→B→C', deps: [] },
          { type: 'SVC',   techName: 'PdfTextExtractor',    priority: 'P0', flow: 'A→B→C', deps: [] },
        ],
      },
    },
  });

  const issues = gate.checkIterActionBudget(draft);
  const budget001 = issues.filter(i => i.code === 'BUDGET-001');

  assert(budget001.length === 1, 'Case 1: 應有 1 個 BUDGET-001');
  assert(budget001[0].level === 'BLOCKER', 'Case 1: BUDGET-001 應為 BLOCKER');
  assert(
    budget001[0].msg.includes('5') && budget001[0].msg.includes('4'),
    'Case 1: BUDGET-001 訊息應提到實際數 5 和上限 4'
  );
  assert(
    budget001[0].msg.includes('iter-2'),
    'Case 1: BUDGET-001 應指向 iter-2'
  );
}

// ============================================================
// Case 2: Level M, iter-2 有 4 個動作 → BUDGET-002 WARN (剛好到限)
// ============================================================
console.log('\n=== Case 2: Level M, iter-2 有 4 個動作 → BUDGET-002 WARN ===');
{
  const draft = makeDraft({
    level: 'M',
    iterationPlan: [
      { iter: 1, module: 'shared', delivery: 'INFRA', status: '[CURRENT]', goal: '', deps: [] },
      { iter: 2, module: 'exam_engine', delivery: 'FULL', status: '[STUB]', goal: '', deps: [] },
    ],
    moduleActions: {
      exam_engine: {
        iter: 2,
        fillLevel: 'current',
        items: [
          { type: 'SVC',   techName: 'ExamService',    priority: 'P0', flow: 'A→B', deps: [] },
          { type: 'UI',    techName: 'ExamPage',       priority: 'P1', flow: 'A→B', deps: [] },
          { type: 'ROUTE', techName: 'ExamRoute',      priority: 'P1', flow: 'A→B', deps: [] },
          { type: 'HOOK',  techName: 'useExamState',   priority: 'P2', flow: 'A→B', deps: [] },
        ],
      },
    },
  });

  const issues = gate.checkIterActionBudget(draft);
  const budget001 = issues.filter(i => i.code === 'BUDGET-001');
  const budget002 = issues.filter(i => i.code === 'BUDGET-002');

  assert(budget001.length === 0, 'Case 2: 4 個動作不應觸發 BUDGET-001');
  assert(budget002.length === 1, 'Case 2: 4 個動作剛好到限，應觸發 BUDGET-002 WARN');
  assert(budget002[0].level === 'WARN', 'Case 2: BUDGET-002 應為 WARN（不阻擋）');
}

// ============================================================
// Case 3: Level M, iter-2 有 3 個動作 → PASS
// ============================================================
console.log('\n=== Case 3: Level M, iter-2 有 3 個動作 → PASS ===');
{
  const draft = makeDraft({
    level: 'M',
    iterationPlan: [
      { iter: 2, module: 'user_grading', delivery: 'FULL', status: '[CURRENT]', goal: '', deps: [] },
    ],
    moduleActions: {
      user_grading: {
        iter: 2,
        fillLevel: 'current',
        items: [
          { type: 'SVC',   techName: 'GradingService', priority: 'P0', flow: 'A→B', deps: [] },
          { type: 'UI',    techName: 'GradingPage',    priority: 'P1', flow: 'A→B', deps: [] },
          { type: 'ROUTE', techName: 'GradingRoute',   priority: 'P1', flow: 'A→B', deps: [] },
        ],
      },
    },
  });

  const issues = gate.checkIterActionBudget(draft);
  const budget001 = issues.filter(i => i.code === 'BUDGET-001');
  const budget002 = issues.filter(i => i.code === 'BUDGET-002');

  assert(budget001.length === 0, 'Case 3: 3 個動作未超標，不應有 BUDGET-001');
  assert(budget002.length === 0, 'Case 3: 3 個動作未到限，不應有 BUDGET-002');
}

// ============================================================
// Case 4: Foundation iter-1（全 CONST/LIB），5 個動作 → 豁免，PASS
// ============================================================
console.log('\n=== Case 4: Foundation iter-1（全 CONST/LIB）, 5 個動作 → 豁免 PASS ===');
{
  const draft = makeDraft({
    level: 'M',
    iterationPlan: [
      { iter: 1, module: 'shared', delivery: 'INFRA', status: '[CURRENT]', goal: '', deps: [] },
    ],
    moduleActions: {
      shared: {
        iter: 1,
        fillLevel: 'current',
        items: [
          { type: 'CONST',  techName: 'CoreTypes',    priority: 'P0', flow: 'DEFINE→EXPORT', deps: [] },
          { type: 'CONST',  techName: 'ENV_CONFIG',   priority: 'P2', flow: 'LOAD→EXPORT',   deps: [] },
          { type: 'LIB',    techName: 'storage',      priority: 'P1', flow: 'INIT→CRUD',     deps: [] },
          { type: 'LIB',    techName: 'validator',    priority: 'P2', flow: 'INIT→VALIDATE', deps: [] },
          { type: 'SCRIPT', techName: 'db_migrate',   priority: 'P3', flow: 'READ→RUN',      deps: [] },
        ],
      },
    },
  });

  const issues = gate.checkIterActionBudget(draft);
  const budget001 = issues.filter(i => i.code === 'BUDGET-001');
  const budget002 = issues.filter(i => i.code === 'BUDGET-002');

  assert(budget001.length === 0, 'Case 4: Foundation iter 全 CONST/LIB/SCRIPT → 豁免，無 BUDGET-001');
  assert(budget002.length === 0, 'Case 4: Foundation iter 全 CONST/LIB/SCRIPT → 豁免，無 BUDGET-002');
}

// ============================================================
// Case 5: delivery = BACKEND → VSC-003 BLOCKER
// ============================================================
console.log('\n=== Case 5: delivery = BACKEND → VSC-003 BLOCKER ===');
{
  const draft = makeDraft({
    level: 'M',
    iterationPlan: [
      { iter: 2, module: 'exam_engine', delivery: 'BACKEND', status: '[CURRENT]', goal: '', deps: [] },
    ],
    moduleActions: {
      exam_engine: {
        iter: 2,
        fillLevel: 'current',
        items: [
          { type: 'SVC',   techName: 'ExamService',  priority: 'P0', flow: 'A→B', deps: [] },
          { type: 'ROUTE', techName: 'ExamRoute',    priority: 'P1', flow: 'A→B', deps: [] },
          { type: 'UI',    techName: 'ExamPage',     priority: 'P1', flow: 'A→B', deps: [] },
        ],
      },
    },
  });

  const issues = gate.checkVerticalSliceCompleteness(draft, 2);
  const vsc003 = issues.filter(i => i.code === 'VSC-003');

  assert(vsc003.length === 1, 'Case 5: delivery=BACKEND 應觸發 VSC-003 BLOCKER');
  assert(vsc003[0].level === 'BLOCKER', 'Case 5: VSC-003 應為 BLOCKER');
  assert(
    vsc003[0].msg.includes('BACKEND') || vsc003[0].msg.includes('FULL'),
    'Case 5: VSC-003 訊息應提到 BACKEND 和 FULL'
  );
}

// ============================================================
// Case 6: delivery = FULL → VSC-003 不觸發
// ============================================================
console.log('\n=== Case 6: delivery = FULL → VSC-003 不觸發 ===');
{
  const draft = makeDraft({
    level: 'M',
    iterationPlan: [
      { iter: 2, module: 'user_grading', delivery: 'FULL', status: '[CURRENT]', goal: '', deps: [] },
    ],
    moduleActions: {
      user_grading: {
        iter: 2,
        fillLevel: 'current',
        items: [
          { type: 'SVC',   techName: 'GradingService', priority: 'P0', flow: 'A→B', deps: [] },
          { type: 'UI',    techName: 'GradingPage',    priority: 'P1', flow: 'A→B', deps: [] },
          { type: 'ROUTE', techName: 'GradingRoute',   priority: 'P1', flow: 'A→B', deps: [] },
        ],
      },
    },
  });

  const issues = gate.checkVerticalSliceCompleteness(draft, 2);
  const vsc003 = issues.filter(i => i.code === 'VSC-003');

  assert(vsc003.length === 0, 'Case 6: delivery=FULL 不應觸發 VSC-003');
}

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`Blueprint Gate BUDGET + VSC-003 測試結果: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('❌ 有測試失敗，請檢查 blueprint-gate.cjs 的 checkIterActionBudget() 和 checkVerticalSliceCompleteness()');
} else {
  console.log('✅ 所有 BUDGET + VSC-003 測試通過');
}
process.exit(fail > 0 ? 1 : 0);
