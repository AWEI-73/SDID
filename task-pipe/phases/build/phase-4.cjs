#!/usr/bin/env node
/**
 * BUILD Phase 4: Test Gate v3.0
 * 輸入: 源碼 + 測試 | 產物: P0/P1 測試驗證 + checkpoint
 * 
 * v3.0 變更：整合 Test Type Gate
 * - 驗證 P0 有 E2E 測試
 * - 驗證 P1 有 Integration 測試  
 * - 偵測假整合測試（過度 Mock）
 * 
 * 驗證規則 (blocking):
 * - testFileExists: GEMS-TEST-FILE 指定的測試檔案必須存在
 * - testImportsFunction: 測試檔案必須 import 被測函式
 * - testTypeMatch: 測試類型必須符合 Priority (v3.0 新增)
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
const { scanGemsTags, validateTestFiles, validateTestTypes } = require('../../lib/scan/gems-validator.cjs');
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
      { name: 'GEMS-TEST-FILE 存在', pattern: '測試檔案路徑有效', desc: '標籤指定的測試檔必須存在' },
      { name: '測試 import 被測函式', pattern: 'import { fn }', desc: '測試必須真正 import 函式' },
      { name: 'P0 有 E2E', pattern: '*.e2e.test.ts', desc: 'P0 函式必須有 E2E 測試' },
      { name: 'P1 有 Integration', pattern: '*.integration.test.ts', desc: 'P1 函式必須有整合測試' },
      { name: 'GEMS-DEPS-RISK 正確', pattern: 'LOW|MEDIUM|HIGH', desc: '風險等級與依賴匹配' }
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

  // 掃描標籤
  const scanResult = scanGemsTags(srcPath);
  const missingTests = validateTestFiles(scanResult.functions, srcPath, target);
  const testCoverage = checkTestCoverage(scanResult.functions, srcPath, target);

  // 統計 P0/P1
  const p0Fns = scanResult.functions.filter(f => f.priority === 'P0');
  const p1Fns = scanResult.functions.filter(f => f.priority === 'P1');
  const p0Tested = p0Fns.filter(f => f.testFile && !missingTests.find(m => m.fn === f.name) && testCoverage.covered.includes(f.name));
  const p1Tested = p1Fns.filter(f => f.testFile && !missingTests.find(m => m.fn === f.name) && testCoverage.covered.includes(f.name));

  const p0Pass = p0Fns.length === 0 || p0Tested.length === p0Fns.length;
  const p1Pass = p1Fns.length === 0 || p1Tested.length === p1Fns.length;
  const riskIssues = checkRiskLevels(scanResult.functions);

  // v3.0: Test Type Gate - 檢查測試類型
  const testTypeResult = validateTestTypes(scanResult.functions, srcPath, target);

  // v3.1: 後端/library 專案放寬 E2E 要求 — 降級為 WARNING
  let techStackProfile = null;
  try {
    const { analyzeTechStack } = require('../../lib/build/tech-stack-analyzer.cjs');
    techStackProfile = analyzeTechStack(target, iteration);
  } catch (e) { /* ignore */ }
  const isBackendProject = techStackProfile?.projectType === 'backend' || techStackProfile?.projectType === 'unknown';

  let criticalIssues, warningIssues;
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

  const passed = missingTests.length === 0 && p0Pass && p1Pass &&
    riskIssues.length === 0 && criticalIssues.length === 0;

  // 通過
  if (passed) {
    handlePhaseSuccess('BUILD', '4', story);
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

    emitPass({
      scope: 'BUILD Phase 4',
      summary: `P0: ${p0Tested.length}/${p0Fns.length} (E2E: ${testTypeResult.stats.p0WithE2E}) | P1: ${p1Tested.length}/${p1Fns.length} (Integration: ${testTypeResult.stats.p1WithIntegration})${warningNote}${typeWarningNote}`,
      nextCmd: getNextCmd('BUILD', '4', { story, level })
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
      expectedParts.push(`import { ${issue.fn} } from '${fnFile.replace(/\\/g, '/').replace(/\.ts$/, '')}'`);
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
      nextCommand: getRetryCmd('BUILD', '4', { story })
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
        expected = `import { ${fn.name} } from '${(fn.file || '').replace(/\\/g, '/').replace(/\.ts$/, '')}'\n             必須有 describe('${fn.name}') 和至少一個 it/test`;
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
      nextCommand: getRetryCmd('BUILD', '4', { story })
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
      nextCommand: getRetryCmd('BUILD', '4', { story })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-4',
      story
    });
    return { verdict: 'BLOCKER', reason: '風險等級錯誤' };
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
      expected: `import { ${m.fn} } from '${fnFile.replace(/\\/g, '/').replace(/\.ts$/, '')}'\n             必須有 describe('${m.fn}') 和至少一個有效 assertion`,
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
    nextCommand: getRetryCmd('BUILD', '4', { story }),
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
 * 檢查測試覆蓋（測試檔案是否 import 被測函式）
 */
function checkTestCoverage(functions, srcPath, target) {
  const coverage = { covered: [], notCovered: [] };

  for (const fn of functions) {
    if (!fn.testFile) continue;

    // fn.file 已經是相對於 cwd 的路徑 (e.g., recipe-manager/src/modules/...)
    // 不需要再 join srcPath
    const sourceDir = fn.file ? path.dirname(path.resolve(fn.file)) : path.resolve(srcPath);
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
