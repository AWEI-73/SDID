#!/usr/bin/env node
/**
 * SDID v2.1 功能測試
 * 
 * 測試項目:
 * 1. Parser: 變異點分析解析 + 演化欄位解析
 * 2. Gate: 演化層依賴驗證
 * 3. Verify: 藍圖↔源碼雙向比對
 * 4. Shrink: [EVOLVED] 狀態支援
 * 5. Draft-to-Plan: Modify 動作支援
 */

const path = require('path');
const fs = require('fs');

// 載入模組
const parser = require('../lib/draft-parser-standalone.cjs');
const gate = require('../blueprint-gate.cjs');
const verify = require('../blueprint-verify.cjs');
const shrink = require('../blueprint-shrink.cjs');
const plan = require('../draft-to-plan.cjs');

const FIXTURES = path.join(__dirname, 'fixtures');
const BLUEPRINT_PATH = path.join(FIXTURES, 'meal-pricing-blueprint.md');
const FUNCTIONS_PATH = path.join(FIXTURES, 'mock-functions.json');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

// ============================================
// Test 1: Parser — 變異點分析解析
// ============================================
console.log('\n📋 Test 1: Parser — 變異點分析解析');

const rawContent = fs.readFileSync(BLUEPRINT_PATH, 'utf8');
const draft = parser.parse(rawContent);

assert(draft.variationPoints !== null, '變異點分析區塊被解析');
assert(draft.variationPoints.nouns.length === 6, `名詞數量 = 6 (實際: ${draft.variationPoints.nouns.length})`);

const fixedNouns = draft.variationPoints.nouns.filter(n => n.fixed);
const variableNouns = draft.variationPoints.nouns.filter(n => n.variable);
assert(fixedNouns.length === 2, `固定名詞 = 2 (實際: ${fixedNouns.length})`);
assert(variableNouns.length === 4, `可變名詞 = 4 (實際: ${variableNouns.length})`);

assert(draft.variationPoints.layers.length === 5, `分層數量 = 5 (實際: ${draft.variationPoints.layers.length})`);
assert(draft.variationPoints.layers[0].layer === 'BASE', `第一層 = BASE`);
assert(draft.variationPoints.layers[1].layer === 'L1', `第二層 = L1`);

const confirmed = draft.variationPoints.confirmed.filter(c => c.checked);
assert(confirmed.length === 3, `已確認層數 = 3 (實際: ${confirmed.length})`);

// ============================================
// Test 2: Parser — 演化欄位解析
// ============================================
console.log('\n📋 Test 2: Parser — 演化欄位解析');

const sharedActions = draft.moduleActions['shared'];
assert(sharedActions !== undefined, 'shared 模組動作存在');
assert(sharedActions.items.length === 4, `shared 動作數 = 4 (實際: ${sharedActions.items.length})`);

const coreTypes = sharedActions.items.find(i => i.techName === 'CoreTypes');
assert(coreTypes !== undefined, 'CoreTypes 動作存在');
assert(coreTypes.evolution === 'BASE', `CoreTypes 演化 = BASE (實際: ${coreTypes.evolution})`);

// ============================================
// Test 3: Gate — 基本驗證通過
// ============================================
console.log('\n📋 Test 3: Gate — 基本驗證');

const fmtIssues = gate.checkFormatCompleteness(draft);
const blockerFmt = fmtIssues.filter(i => i.level === 'BLOCKER');
assert(blockerFmt.length === 0, `格式完整性無 BLOCKER (實際: ${blockerFmt.length})`);

const tagIssues = gate.checkTagIntegrity(draft, 1);
const blockerTag = tagIssues.filter(i => i.level === 'BLOCKER');
assert(blockerTag.length === 0, `標籤完整性無 BLOCKER (實際: ${blockerTag.length})`);

const dagIssues = gate.checkIterationDAG(draft);
assert(dagIssues.length === 0, `迭代 DAG 無問題 (實際: ${dagIssues.length})`);

const cycleIssues = gate.checkDependencyCycles(draft);
assert(cycleIssues.length === 0, `無循環依賴 (實際: ${cycleIssues.length})`);

// ============================================
// Test 4: Gate — 演化層驗證
// ============================================
console.log('\n📋 Test 4: Gate — 演化層驗證');

const evoIssues = gate.checkEvolutionLayers(draft);
assert(evoIssues.length === 0, `演化層驗證通過 (實際問題: ${evoIssues.length})`);

// 測試違規情境: 建立一個 BASE 依賴 L1 的假藍圖
const badDraft = JSON.parse(JSON.stringify(draft));
badDraft.moduleActions['shared'].items.push({
  techName: 'badFunc',
  priority: 'P2',
  flow: 'A→B→C',
  deps: '[Internal.futureL1Func]',
  status: '○○',
  evolution: 'BASE',
  type: 'SVC',
  semantic: '測試用',
});
badDraft.moduleActions['shared'].items.push({
  techName: 'futureL1Func',
  priority: 'P1',
  flow: 'A→B→C',
  deps: '無',
  status: '○○',
  evolution: 'L1',
  type: 'SVC',
  semantic: '測試用 L1',
});

const badEvoIssues = gate.checkEvolutionLayers(badDraft);
const evoBlockers = badEvoIssues.filter(i => i.code === 'EVO-001');
assert(evoBlockers.length === 1, `偵測到 BASE→L1 違規依賴 (實際: ${evoBlockers.length})`);

// ============================================
// Test 5: Verify — 藍圖↔源碼比對
// ============================================
console.log('\n📋 Test 5: Verify — 藍圖↔源碼比對');

const codeFunctions = verify.loadFunctions(FUNCTIONS_PATH);
assert(codeFunctions.length === 4, `載入 4 個函式 (實際: ${codeFunctions.length})`);

const blueprintActions = verify.extractBlueprintActions(draft, 1);
assert(blueprintActions.length === 4, `藍圖動作 = 4 (實際: ${blueprintActions.length})`);

const comparison = verify.compareActions(blueprintActions, codeFunctions);
assert(comparison.matched.length === 3, `匹配 = 3 (實際: ${comparison.matched.length})`);
assert(comparison.missing.length === 1, `缺失 = 1 (planService) (實際: ${comparison.missing.length})`);
assert(comparison.extra.length === 1, `多餘 = 1 (validateMealItem) (實際: ${comparison.extra.length})`);

// 檢查缺失的是 planService
const missingNames = comparison.missing.map(m => m.techName);
assert(missingNames.includes('planService'), `缺失函式包含 planService`);

// 檢查多餘的是 validateMealItem
const extraNames = comparison.extra.map(e => e.name);
assert(extraNames.includes('validateMealItem'), `多餘函式包含 validateMealItem`);

// ============================================
// Test 6: Verify — 報告生成
// ============================================
console.log('\n📋 Test 6: Verify — 報告生成');

const verifyJson = verify.generateVerifyJson(draft, comparison, { draft: BLUEPRINT_PATH, iter: 1 });
assert(verifyJson.summary.coverage === 75, `覆蓋率 = 75% (實際: ${verifyJson.summary.coverage}%)`);
assert(verifyJson.summary.matched === 3, `JSON matched = 3`);
assert(verifyJson.summary.missing === 1, `JSON missing = 1`);

const verifyMd = verify.generateVerifyMarkdown(verifyJson);
assert(verifyMd.includes('Blueprint Verify Report'), 'Markdown 報告包含標題');
assert(verifyMd.includes('planService'), 'Markdown 報告包含缺失函式');
assert(verifyMd.includes('validateMealItem'), 'Markdown 報告包含多餘函式');

// ============================================
// Test 7: Shrink — [EVOLVED] 狀態
// ============================================
console.log('\n📋 Test 7: Shrink — [EVOLVED] 狀態');

// 測試有演化層的統計
const evolvedMod = {
  items: [
    { priority: 'P0', status: '✓✓', evolution: 'BASE' },
    { priority: 'P1', status: '✓✓', evolution: 'L1' },
    { priority: 'P2', status: '✓✓', evolution: 'L1' },
  ]
};
const evoStats = shrink.collectActionStats(evolvedMod);
assert(evoStats.evolutionLayers.includes('BASE'), '統計包含 BASE 層');
assert(evoStats.evolutionLayers.includes('L1'), '統計包含 L1 層');
assert(evoStats.total === 3, `動作總數 = 3`);

// 測試 EVOLVED 摘要生成
evoStats.iter = 2;
const evoSummary = shrink.generateDoneSummary('pricing', evoStats, null);
assert(evoSummary.includes('[EVOLVED]'), `摘要包含 [EVOLVED] 標記 (實際: ${evoSummary.substring(0, 60)}...)`);
assert(evoSummary.includes('演化: BASE,L1'), `摘要包含演化層資訊`);

// 測試純 BASE 的摘要 (應該是 [DONE])
const baseMod = {
  items: [
    { priority: 'P0', status: '✓✓', evolution: 'BASE' },
    { priority: 'P1', status: '✓✓', evolution: 'BASE' },
  ]
};
const baseStats = shrink.collectActionStats(baseMod);
baseStats.iter = 1;
const baseSummary = shrink.generateDoneSummary('shared', baseStats, null);
assert(baseSummary.includes('[DONE]'), `純 BASE 摘要使用 [DONE]`);
assert(!baseSummary.includes('[EVOLVED]'), `純 BASE 摘要不含 [EVOLVED]`);

// ============================================
// Test 8: Draft-to-Plan — Modify 動作支援
// ============================================
console.log('\n📋 Test 8: Draft-to-Plan — Modify 動作支援');

const modifyActions = [
  {
    techName: 'PricingTypes',
    type: 'CONST',
    priority: 'P0',
    flow: 'EXTEND→VALIDATE→FREEZE',
    deps: '[Internal.CoreTypes]',
    semantic: '計價型別擴充',
    evolution: 'L1',
  },
  {
    techName: 'calcWeekly [Modify]',
    type: 'SVC',
    priority: 'P0',
    flow: 'LOAD_PRICES→CALC_BY_TYPE→SUM→RETURN',
    deps: '[Internal.PricingTypes]',
    semantic: '計價邏輯修改 (加入單價彈性)',
    evolution: 'L1',
  },
];

const planContent = plan.generatePlan(draft, 2, 0, 'pricing', modifyActions);
assert(planContent.includes('MODIFY'), 'Plan 包含 MODIFY 類型');
assert(planContent.includes('**Evolution**: L1'), 'Plan 包含 Evolution 標記');
assert(planContent.includes('Modify'), 'Plan 檔案動作包含 Modify');
assert(!planContent.includes('[Modify]'), 'Plan 中 techName 已清除 [Modify] 標記');
assert(planContent.includes('calcWeekly'), 'Plan 包含 calcWeekly 函式名');

// ============================================
// Test 9: Parser — 名稱正規化
// ============================================
console.log('\n📋 Test 9: Verify — 名稱正規化');

assert(verify.normalize('CoreTypes') === 'coretypes', 'CoreTypes → coretypes');
assert(verify.normalize('calc_weekly') === 'calcweekly', 'calc_weekly → calcweekly');
assert(verify.normalize('calc-weekly') === 'calcweekly', 'calc-weekly → calcweekly');
assert(verify.normalize('CalcWeekly') === 'calcweekly', 'CalcWeekly → calcweekly');

// ============================================
// Test 10: 完整 Gate 通過
// ============================================
console.log('\n📋 Test 10: 完整 Gate 通過 (meal-pricing-blueprint)');

const allIssues = [
  ...gate.checkFormatCompleteness(draft),
  ...gate.checkPlaceholders(rawContent),
  ...gate.checkTagIntegrity(draft, 1),
  ...gate.checkFlowStepCount(draft, 1),
  ...gate.checkDependencyCycles(draft),
  ...gate.checkIterationDAG(draft),
  ...gate.checkInfraSize(draft),
  ...gate.checkStubMinimum(draft, 1),
  ...gate.checkPlanActionConsistency(draft),
  ...gate.checkLevelLimits(draft),
  ...gate.checkEvolutionLayers(draft),
];

const allBlockers = allIssues.filter(i => i.level === 'BLOCKER');
assert(allBlockers.length === 0, `全部驗證無 BLOCKER (實際: ${allBlockers.length})`);

if (allBlockers.length > 0) {
  for (const b of allBlockers) {
    console.log(`    [${b.code}] ${b.msg}`);
  }
}

const allWarns = allIssues.filter(i => i.level === 'WARN');
console.log(`  ℹ️ WARN 數量: ${allWarns.length}`);

// ============================================
// 結果
// ============================================
console.log(`\n${'='.repeat(50)}`);
console.log(`📊 測試結果: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
