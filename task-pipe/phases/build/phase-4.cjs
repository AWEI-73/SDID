#!/usr/bin/env node
/**
 * BUILD Phase 4: Test Gate v4.0
 * 輸入: 源碼 + 測試 | 產物: P0/P1 測試驗證 + AC coverage + checkpoint
 * 
 * v4.0 變更：AC coverage 層 + GEMS-TEST-FILE 降為 hint
 * - ac-runner/poc-html/skip 策略直接 skip（不驗 AC coverage）
 * - jest-unit/jest-integ 策略：掃測試檔，驗每個函式有 it('AC-X.Y') pattern
 * - GEMS-TEST-FILE 從 BLOCKER 降為 hint（有填優先用，沒填從路徑推導）
 * - 保留：isFakeIntegrationTest()、import 驗證、checkRiskLevels()
 * 
 * 優先級規則:
 * - P0: Unit + Integration + E2E (CRITICAL if missing)
 * - P1: Unit + Integration (WARNING if missing)
 * - P2: Unit (建議)
 */
const fs = require('fs');
const path = require('path');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { writeCheckpoint } = require('../../lib/checkpoint.cjs');
const { scanGemsTags, validateTestFiles, validateTestTypes } = require('../../lib/scan/gems-scanner-unified.cjs');
const { createErrorHandler, handlePhaseSuccess, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');
const { anchorPass, anchorError, anchorErrorSpec, emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd } = require('../../lib/shared/next-command-helper.cjs');

function run(options) {

  console.log(getSimpleHeader('BUILD', 'Phase 4'));

  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';


  // 門控規格 - 告訴 AI 這個 phase 會檢查什麼
  const gateSpec = {
    checks: [
      { name: 'ac-runner/poc-html/skip 直接 skip', desc: '這些策略函式不需要 jest，直接過' },
      { name: 'jest 函式有測試檔', desc: 'jest-unit/jest-integ 需要測試檔案存在' },
      { name: '測試 import 被測函式', desc: '測試必須真正 import 函式，不能只有 toBeDefined()' },
      { name: "AC coverage: it('AC-X.Y')", desc: 'contract 有 AC 時，每個 AC 必須有對應 it()' },
      { name: 'GEMS-TEST-FILE 為 hint', desc: '有填優先用，沒填從路徑推導，不擋建置' }
    ]
  };

  if (!story) {
    emitFix({
      scope: 'BUILD Phase 4',
      summary: '缺少 --story 參數',
      targetFile: 'CLI 參數',
      missing: ['--story 參數'],
      example: `node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-1.0 --target=${relativeTarget}`,
      nextCmd: 'node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y',
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      phase: 'build',
      step: 'phase-4',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  const { type: projectType } = detectProjectType(target);
  const srcPath = getSrcDir(target, projectType);

  if (!fs.existsSync(srcPath)) {
    emitFix({
      scope: `BUILD Phase 4 | ${story}`,
      summary: '源碼目錄不存在',
      targetFile: srcPath,
      missing: ['源碼目錄'],
      example: `# 請先完成 Phase 1-3
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story} --target=${relativeTarget}`,
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story}`,
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-4',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // 掃描標籤，先做分組再使用
  const scanResult = scanGemsTags(srcPath);

  // v4.0: ac-runner/poc-html/skip 策略直接 skip，不驗 AC coverage
  const skipStrategies = ['ac-runner', 'poc-html', 'skip'];
  const jestFns = scanResult.functions.filter(f => {
    const s = (f.testStrategy || '').toLowerCase();
    return s === 'jest-unit' || s === 'jest-integ';
  });
  const skipFns = scanResult.functions.filter(f => {
    const s = (f.testStrategy || '').toLowerCase();
    return skipStrategies.includes(s);
  });
  // 沒有 GEMS-TEST 標籤的函式（舊格式）也走 jest 路徑
  const unknownFns = scanResult.functions.filter(f => !f.testStrategy);
  // 需要 jest 驗證的函式（先宣告，後面才能安全使用）
  const jestTargetFns = jestFns.length > 0 ? jestFns : unknownFns;

  const missingTests = validateTestFiles(jestTargetFns, srcPath, target);
  const testCoverage = checkTestCoverage(jestTargetFns, srcPath, target);

  if (skipFns.length > 0 && jestTargetFns.length === 0) {
    // 全部都是 skip 策略，直接 PASS
    writeCheckpoint(target, iteration, story, '4', {
      verdict: 'PASS',
      skipFns: skipFns.length,
      reason: 'all-skip-strategy'
    });
    emitPass({
      scope: 'BUILD Phase 4',
      summary: `全部 ${skipFns.length} 個函式為 ac-runner/poc-html/skip 策略，跳過 Test Gate`,
      nextCmd: getNextCmd('BUILD', '4', { story, level, target: relativeTarget, iteration })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-4',
      story
    });
    return { verdict: 'PASS' };
  }

  // v4.0: AC coverage 層 — 從 contract 讀取 requiredACs，掃 coveredACs，找缺口
  const acCoverageResult = checkAcCoverage(jestTargetFns, srcPath, target, iteration);
  if (acCoverageResult.skipped) {
    console.log(`[AC] 跳過 AC coverage 檢查（contract 不存在）`);
  } else if (acCoverageResult.gaps.length > 0) {
    console.log(`[AC] ${acCoverageResult.gaps.length} 個 AC 未被測試覆蓋`);
  }

  // 統計 P0/P1（只針對 jest 函式）
  const p0Fns = jestTargetFns.filter(f => f.priority === 'P0');
  const p1Fns = jestTargetFns.filter(f => f.priority === 'P1');
  const p0Tested = p0Fns.filter(f => f.testFile && !missingTests.find(m => m.fn === f.name) && testCoverage.covered.includes(f.name));
  const p1Tested = p1Fns.filter(f => f.testFile && !missingTests.find(m => m.fn === f.name) && testCoverage.covered.includes(f.name));

  const p0Pass = p0Fns.length === 0 || p0Tested.length === p0Fns.length;
  const p1Pass = p1Fns.length === 0 || p1Tested.length === p1Fns.length;
  const riskIssues = checkRiskLevels(scanResult.functions);

  // v3.0: Test Type Gate - 只針對 jest 函式檢查測試類型
  const testTypeResult = validateTestTypes(jestTargetFns, srcPath, target);

  // v3.1: 後端/library 專案放寬 E2E 要求 — 降級為 WARNING
  let techStackProfile = null;
  try {
    const { analyzeTechStack } = require('../../lib/build/tech-stack-analyzer.cjs');
    techStackProfile = analyzeTechStack(target, iteration);
  } catch (e) { /* ignore */ }
  const isBackendProject = techStackProfile?.projectType === 'backend' || techStackProfile?.projectType === 'unknown';

  let criticalIssues, warningIssues, downgradeIssues;
  if (isBackendProject) {
    // 後端專案: E2E CRITICAL → WARNING (保留 Integration CRITICAL)
    criticalIssues = testTypeResult.issues.filter(i =>
      i.severity === 'CRITICAL' && !i.issue.includes('E2E')
    );
    warningIssues = testTypeResult.issues.filter(i =>
      i.severity === 'WARNING' || (i.severity === 'CRITICAL' && i.issue.includes('E2E'))
    );
    if (testTypeResult.issues.some(i => i.severity === 'CRITICAL' && i.issue.includes('E2E'))) {
      console.log(`[INFO] 後端專案 (${techStackProfile?.projectType}) — P0 E2E 要求降級為 WARNING`);
    }
  } else {
    criticalIssues = testTypeResult.issues.filter(i => i.severity === 'CRITICAL');
    warningIssues = testTypeResult.issues.filter(i => i.severity === 'WARNING');
  }
  downgradeIssues = testTypeResult.issues.filter(i => i.severity === 'DOWNGRADE_SUGGESTION');

  const passed = missingTests.length === 0 && p0Pass && p1Pass &&
    riskIssues.length === 0 && criticalIssues.length === 0 &&
    (!acCoverageResult || acCoverageResult.skipped || acCoverageResult.gaps.length === 0);

  // 通過
  if (passed) {
    handlePhaseSuccess('BUILD', '4', story, target);
    writeCheckpoint(target, iteration, story, '4', {
      verdict: 'PASS',
      p0: { total: p0Fns.length, tested: p0Tested.length, withE2E: testTypeResult.stats.p0WithE2E },
      p1: { total: p1Fns.length, tested: p1Tested.length, withIntegration: testTypeResult.stats.p1WithIntegration },
      testTypeGate: { warnings: warningIssues.length }
    });

    const warningNote = testCoverage.notCovered.length > 0
      ? `\n[WARN] ${testCoverage.notCovered.length} 個函式未被測試 import`
      : '';
    const typeWarningNote = warningIssues.length > 0
      ? `\n[WARN] ${warningIssues.length} 個假整合測試 (過度 Mock)`
      : '';
    const downgradeNote = downgradeIssues.length > 0
      ? `\n[DOWNGRADE] ${downgradeIssues.length} 個宣告型別建議降級 priority`
      : '';
    const acNote = (!acCoverageResult || acCoverageResult.skipped)
      ? ''
      : `\n[AC] ${acCoverageResult.covered}/${acCoverageResult.total} AC 已覆蓋`;

    if (downgradeIssues.length > 0) {
      console.log('');
      console.log('[PRIORITY_DOWNGRADE_SUGGESTION]');
      for (const d of downgradeIssues) {
        console.log(`  ⬇ ${d.fn} (${d.priority}): ${d.suggestion}`);
      }
    }

    emitPass({
      scope: 'BUILD Phase 4',
      summary: `P0: ${p0Tested.length}/${p0Fns.length} (E2E: ${testTypeResult.stats.p0WithE2E}) | P1: ${p1Tested.length}/${p1Fns.length} (Integration: ${testTypeResult.stats.p1WithIntegration})${warningNote}${typeWarningNote}${downgradeNote}${acNote}`,
      nextCmd: getNextCmd('BUILD', '4', { story, level, target: relativeTarget, iteration })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-4',
      story
    });
    return { verdict: 'PASS' };
  }

  // P0/P1 Test Type Gate 失敗 = BLOCKER (v3.0)
  // v4.2: 使用 emitTaskBlock 精確輸出，告訴 AI 每個測試檔案的完整資訊
  if (criticalIssues.length > 0) {
    const { emitTaskBlock } = require('../../lib/shared/log-output.cjs');

    // 先輸出降級建議（如果有）
    if (downgradeIssues.length > 0) {
      console.log('');
      console.log('[PRIORITY_DOWNGRADE_SUGGESTION]');
      console.log(`  以下函式是 interface/type/常數宣告，無執行行為，建議降級 priority 而非強行寫測試:`);
      for (const d of downgradeIssues) {
        console.log(`  ⬇ ${d.fn} (${d.priority}): ${d.suggestion}`);
      }
      console.log('');
    }

    const tasks = criticalIssues.slice(0, 8).map(issue => {
      const fn = scanResult.functions.find(f => f.name === issue.fn);
      const fnFile = fn?.file || '(unknown)';
      const fnDir = fn?.file ? path.dirname(fn.file) : '';
      const fnBaseName = fn?.file ? path.basename(fn.file, path.extname(fn.file)) : issue.fn;
      const testDir = fnDir ? path.join(fnDir, '__tests__') : '';

      // 判斷缺少的測試類型
      let testType = 'unknown';
      let testSuffix = '.test.ts';
      let testDescription = '';
      if (issue.issue.includes('E2E')) {
        testType = 'E2E';
        testSuffix = '.e2e.test.ts';
        testDescription = '端到端測試：測試完整使用者流程，使用真實依賴（不 mock）';
      } else if (issue.issue.includes('Integration') && issue.issue.includes('無效')) {
        testType = 'FIX_INTEGRATION';
        testSuffix = '.integration.test.ts';
        testDescription = '修復假整合測試：移除 jest.mock()，使用真實依賴，加入有效 assertion (toBe/toEqual/toHaveBeenCalledWith)';
      } else if (issue.issue.includes('Integration')) {
        testType = 'INTEGRATION';
        testSuffix = '.integration.test.ts';
        testDescription = '整合測試：使用真實依賴（禁止 jest.mock），驗證模組間互動';
      }

      const testFilePath = testDir ? path.join(testDir, `${fnBaseName}${testSuffix}`) : `__tests__/${fnBaseName}${testSuffix}`;

      // 建構 EXPECTED 內容：告訴 AI 測試裡面要有什麼
      const expectedParts = [];
      expectedParts.push(`import { ${issue.fn} } from '${fnFile.replace(/\\/g, '/').replace(/\.tsx?$/, '')}'`);
      if (testType === 'E2E' || testType === 'INTEGRATION') {
        expectedParts.push('禁止 jest.mock()');
        expectedParts.push('必須有有效 assertion: toBe / toEqual / toHaveBeenCalledWith / toContain / toThrow');
      }
      if (testType === 'FIX_INTEGRATION') {
        expectedParts.push('刪除所有 jest.mock() 呼叫');
        expectedParts.push('將 toBeDefined() / toBeTruthy() 替換為 toBe / toEqual 等有效 assertion');
      }
      if (testType === 'E2E') {
        expectedParts.push('必須有真實互動: localStorage / document / fetch 等');
      }

      const task = {
        action: testType === 'FIX_INTEGRATION' ? 'FIX_TEST' : 'CREATE_TEST',
        file: testFilePath,
        expected: expectedParts.join('\n             ')
      };

      // 加入函式簽名資訊（如果有）
      if (fn?.signature) {
        task.gemsSpec = `${issue.fn} | ${fn.priority} | ${fn.signature} | ${fn.storyId || story}`;
      } else {
        task.gemsSpec = `${issue.fn} | ${issue.priority} | ${story}`;
      }

      // 加入參考來源
      task.reference = `源碼: ${fnFile} | 類型: ${testDescription}`;

      return task;
    });

    emitTaskBlock({
      verdict: 'BLOCKER',
      context: `Phase 4 | ${story} | 缺少 ${criticalIssues.length} 個必要測試`,
      tasks,
      nextCommand: getRetryCmd('BUILD', '4', { story, target: relativeTarget, iteration })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-4',
      story
    });

    return { verdict: 'BLOCKER', reason: 'Test Type Gate 失敗' };
  }

  // P0/P1 缺測試 = BLOCKER
  if (!p0Pass || !p1Pass) {
    const { emitTaskBlock } = require('../../lib/shared/log-output.cjs');
    const missingP0 = p0Fns.filter(f => !p0Tested.find(t => t.name === f.name));
    const missingP1 = p1Fns.filter(f => !p1Tested.find(t => t.name === f.name));
    const allMissing = [...missingP0, ...missingP1];

    const tasks = allMissing.slice(0, 8).map(fn => {
      const fnDir = fn.file ? path.dirname(fn.file) : '';
      const fnBaseName = fn.file ? path.basename(fn.file, path.extname(fn.file)) : fn.name;
      const testDir = fnDir ? path.join(fnDir, '__tests__') : '';

      // 判斷缺少什麼
      const isMissingFile = missingTests.find(m => m.fn === fn.name);

      let action, expected, testFilePath;
      if (isMissingFile) {
        action = 'CREATE_TEST';
        testFilePath = testDir ? path.join(testDir, `${fnBaseName}.test.ts`) : `__tests__/${fnBaseName}.test.ts`;
        expected = `import { ${fn.name} } from '${(fn.file || '').replace(/\\/g, '/').replace(/\.tsx?$/, '')}'\n             必須有 describe('${fn.name}') 和至少一個 it/test`;
      } else {
        action = 'FIX_IMPORT';
        testFilePath = fn.testFile ? (testDir ? path.join(testDir, fn.testFile) : fn.testFile) : '(找不到測試檔案)';
        expected = `測試檔案必須 import { ${fn.name} } from 源碼路徑\n             目前測試檔案存在但沒有 import 被測函式`;
      }

      return {
        action,
        file: testFilePath,
        expected,
        gemsSpec: `${fn.name} | ${fn.priority} | ${fn.storyId || story}`,
        reference: `源碼: ${fn.file || '(unknown)'}`
      };
    });

    emitTaskBlock({
      verdict: 'BLOCKER',
      context: `Phase 4 | ${story} | P0/P1 缺測試 (P0: ${missingP0.length}, P1: ${missingP1.length})`,
      tasks,
      nextCommand: getRetryCmd('BUILD', '4', { story, target: relativeTarget, iteration })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-4',
      story
    });
    return { verdict: 'BLOCKER', reason: 'P0/P1 缺測試' };
  }

  // 風險等級錯誤 = BLOCKER
  if (riskIssues.length > 0) {
    const { emitTaskBlock } = require('../../lib/shared/log-output.cjs');

    const tasks = riskIssues.map(issue => {
      const fn = scanResult.functions.find(f => f.name === issue.fn);
      return {
        action: 'FIX_GEMS_TAG',
        file: fn?.file || '(unknown)',
        expected: `修正 GEMS-DEPS-RISK 標籤: ${issue.issue}`,
        gemsSpec: `${issue.fn} | ${fn?.priority || '?'} | 目前 DEPS-RISK: ${fn?.depsRisk || '(無)'}`
      };
    });

    emitTaskBlock({
      verdict: 'BLOCKER',
      context: `Phase 4 | ${story} | GEMS-DEPS-RISK 標記錯誤 (${riskIssues.length} 個)`,
      tasks,
      nextCommand: getRetryCmd('BUILD', '4', { story, target: relativeTarget, iteration })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-4',
      story
    });
    return { verdict: 'BLOCKER', reason: '風險等級錯誤' };
  }

  // AC coverage gaps = BLOCKER（contract 存在時才檢查）
  if (acCoverageResult && !acCoverageResult.skipped && acCoverageResult.gaps.length > 0) {
    const { emitTaskBlock } = require('../../lib/shared/log-output.cjs');

    const tasks = acCoverageResult.gaps.slice(0, 8).map(gap => {
      const fn = jestTargetFns.find(f => f.name === gap.fn);
      const testFilePath = fn?.testFile
        ? (fn.file ? path.join(path.dirname(fn.file), '__tests__', fn.testFile) : fn.testFile)
        : `__tests__/${gap.fn}.test.ts`;
      return {
        action: 'ADD_AC_TEST',
        file: testFilePath,
        expected: `在測試檔案中加入 it('${gap.acId}: ...') 對應 AC\n             格式: it('${gap.acId}: [描述]', () => { ... })`,
        gemsSpec: `${gap.fn} | ${fn?.priority || '?'} | ${gap.acId}`,
        reference: `contract AC: ${gap.acId}`
      };
    });

    emitTaskBlock({
      verdict: 'BLOCKER',
      context: `Phase 4 | ${story} | AC coverage 缺口 (${acCoverageResult.gaps.length} 個)`,
      tasks,
      nextCommand: getRetryCmd('BUILD', '4', { story, target: relativeTarget, iteration })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-4',
      story
    });
    return { verdict: 'BLOCKER', reason: 'ac_coverage_gap' };
  }

  // 記錄錯誤（每次執行都要記錄，才會累積計數）
  const errorHandler = createErrorHandler('BUILD', '4', story);
  const attempt = errorHandler.recordError('E7', `缺測試: ${missingTests.map(m => m.fn).slice(0, 3).join(', ')}`);

  // 檢查重試次數
  if (errorHandler.shouldBlock()) {
    emitBlock({
      scope: `BUILD Phase 4 | ${story}`,
      summary: `Test Gate 需要進一步完善 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`,
      nextCmd: '建議：架構師協作，分析測試覆蓋率',
      details: `缺測試: ${missingTests.length} 個\nP0: ${p0Tested.length}/${p0Fns.length} | P1: ${p1Tested.length}/${p1Fns.length}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-4',
      story
    });
    return { verdict: 'BLOCKER', reason: 'tactical_fix_limit' };
  }

  const recoveryLevel = errorHandler.getRecoveryLevel();

  // v4.2: 使用 emitTaskBlock 精確輸出
  const { emitTaskBlock } = require('../../lib/shared/log-output.cjs');

  const tasks = missingTests.slice(0, 8).map(m => {
    const fn = scanResult.functions.find(f => f.name === m.fn);
    const fnFile = fn?.file || '(unknown)';
    const fnDir = fn?.file ? path.dirname(fn.file) : '';
    const testDir = fnDir ? path.join(fnDir, '__tests__') : '';
    const testFilePath = testDir ? path.join(testDir, m.testFile) : m.testFile;

    return {
      action: 'CREATE_TEST',
      file: testFilePath,
      expected: `import { ${m.fn} } from '${fnFile.replace(/\\/g, '/').replace(/\.tsx?$/, '')}'\n             必須有 describe('${m.fn}') 和至少一個有效 assertion`,
      gemsSpec: `${m.fn} | ${m.priority} | ${fn?.storyId || story}`,
      reference: `源碼: ${fnFile} | GEMS-TEST-FILE 標籤指定: ${m.testFile}`
    };
  });

  const strategyDrift = recoveryLevel > 1 ? {
    level: recoveryLevel,
    name: recoveryLevel === 2 ? 'STRATEGY_SHIFT' : 'PLAN_ROLLBACK',
    hint: recoveryLevel === 2
      ? '確認測試 import 路徑是否正確，檢查 GEMS-TEST-FILE 標籤'
      : '完整分析測試覆蓋，考慮是否需要調整 Plan'
  } : undefined;

  emitTaskBlock({
    verdict: 'TACTICAL_FIX',
    context: `Phase 4 | ${story} | 缺測試 ${missingTests.length} 個 (${attempt}/${MAX_ATTEMPTS})`,
    tasks,
    nextCommand: getRetryCmd('BUILD', '4', { story, target: relativeTarget, iteration }),
    strategyDrift
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'build',
    step: 'phase-4',
    story
  });

  return { verdict: 'PENDING', attempt, missingTests };
}

/**
 * v4.0: 檢查 AC coverage — 從 contract 讀取 requiredACs，掃測試檔找 it('AC-X.Y')，找缺口
 * @param {object[]} jestFns - 需要 jest 測試的函式
 * @param {string} srcPath - 源碼目錄
 * @param {string} target - 專案根目錄
 * @param {string} iteration - 迭代編號
 * @returns {{ skipped: boolean, gaps: Array, covered: number, total: number }}
 */
function checkAcCoverage(jestFns, srcPath, target, iteration) {
  const iterNum = parseInt(iteration.replace('iter-', ''));
  const contractPath = path.join(
    target, '.gems', 'iterations', `iter-${iterNum}`, 'poc', `contract_iter-${iterNum}.ts`
  );

  if (!fs.existsSync(contractPath)) {
    return { skipped: true, gaps: [], covered: 0, total: 0 };
  }

  let acSpecs = [];
  try {
    const acRunnerPath = path.resolve(__dirname, '..', '..', '..', 'sdid-tools', 'ac-runner.cjs');
    const { parseAcSpecs } = require(acRunnerPath);
    const content = fs.readFileSync(contractPath, 'utf8');
    acSpecs = parseAcSpecs(content);
  } catch (e) {
    return { skipped: true, gaps: [], covered: 0, total: 0 };
  }

  if (acSpecs.length === 0) {
    return { skipped: true, gaps: [], covered: 0, total: 0 };
  }

  // 只檢查 jest 函式的 AC
  const jestFnNames = new Set(jestFns.map(f => f.name));
  const relevantAcs = acSpecs.filter(ac => jestFnNames.has(ac.fn));

  if (relevantAcs.length === 0) {
    return { skipped: true, gaps: [], covered: 0, total: 0 };
  }

  // 掃描所有測試檔案，找 it('AC-X.Y') pattern
  const testFiles = findTestFilesInDir(srcPath);
  const coveredAcIds = new Set();
  const acPattern = /it\s*\(\s*['"`](AC-[\d.]+)/g;

  for (const tf of testFiles) {
    try {
      const content = fs.readFileSync(tf, 'utf8');
      let m;
      while ((m = acPattern.exec(content)) !== null) {
        coveredAcIds.add(m[1]);
      }
      acPattern.lastIndex = 0;
    } catch { /* ignore */ }
  }

  const gaps = relevantAcs
    .filter(ac => !coveredAcIds.has(ac.id))
    .map(ac => ({ fn: ac.fn, acId: ac.id }));

  return {
    skipped: false,
    gaps,
    covered: relevantAcs.length - gaps.length,
    total: relevantAcs.length
  };
}

function findTestFilesInDir(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      findTestFilesInDir(fullPath, files);
    } else if (entry.isFile() && /\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * 檢查測試覆蓋（測試檔案是否 import 被測函式）
 */
function checkTestCoverage(functions, srcPath, target) {
  const coverage = { covered: [], notCovered: [] };

  for (const fn of functions) {
    if (!fn.testFile) continue;

    // fn.file 可能是相對於 target（v2 AST scanner）或相對於 cwd（regex scanner）
    // 統一解析為絕對路徑，優先使用 target（專案根目錄）
    let fnAbsFile = '';
    if (fn.file) {
      if (path.isAbsolute(fn.file)) {
        fnAbsFile = fn.file;
      } else if (target && fs.existsSync(path.join(target, fn.file))) {
        fnAbsFile = path.join(target, fn.file);
      } else {
        fnAbsFile = path.resolve(fn.file); // fallback: 相對於 cwd
      }
    }
    const sourceDir = fnAbsFile ? path.dirname(fnAbsFile) : path.resolve(srcPath);
    const possiblePaths = [
      path.join(sourceDir, '__tests__', fn.testFile),
      path.join(sourceDir, fn.testFile),
      path.join(sourceDir, '..', '__tests__', fn.testFile),
      target ? path.join(target, '__tests__', fn.testFile) : null // v3.2: 支援專案根目錄 __tests__
    ].filter(Boolean);

    let testContent = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        testContent = fs.readFileSync(p, 'utf8');
        break;
      }
    }

    if (testContent) {
      const importPattern = new RegExp(`import\\s*{[^}]*\\b${fn.name}\\b[^}]*}|import\\s+${fn.name}\\b`);
      const matched = importPattern.test(testContent);
      if (matched) {
        coverage.covered.push(fn.name);
      } else {
        coverage.notCovered.push({ fn: fn.name, reason: '測試檔案未 import 被測函式' });
      }
    }
  }

  return coverage;
}

// 自我執行判斷
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';
  let story = null;
  let level = 'M';

  // 簡單參數解析
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    if (arg.startsWith('--story=')) story = arg.split('=')[1];
    if (arg.startsWith('--level=')) level = arg.split('=')[1];
  });

  // 確保 target 是絕對路徑
  if (!path.isAbsolute(target)) {
    target = path.resolve(process.cwd(), target);
  }

  run({ target, iteration, story, level });
}

module.exports = { run };


/**
 * 檢查風險等級是否正確標記
 */
function checkRiskLevels(functions) {
  const issues = [];

  for (const fn of functions) {
    if (!fn.depsRisk) continue;

    // 確保 deps 是陣列
    const deps = Array.isArray(fn.deps) ? fn.deps : [];
    const hasDeps = deps.length > 0;
    const hasExternalDeps = hasDeps && deps.some(d =>
      /api|http|fetch|axios|database|db|sql|storage/i.test(String(d))
    );

    // 有外部依賴但標 LOW
    if (hasExternalDeps && fn.depsRisk === 'LOW') {
      issues.push({
        fn: fn.name,
        issue: `有外部依賴 (${deps.slice(0, 2).join(', ')}) 但標記為 LOW，應至少 MEDIUM`
      });
    }

    // 無依賴但標 HIGH
    if (!hasDeps && fn.depsRisk === 'HIGH') {
      issues.push({
        fn: fn.name,
        issue: '無依賴但標記為 HIGH，應為 LOW'
      });
    }
  }

  return issues;
}
