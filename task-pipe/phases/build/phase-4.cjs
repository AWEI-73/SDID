#!/usr/bin/env node
/**
 * BUILD Phase 4: Test Gate v5.0
 * 輸入: 源碼 + 測試 | 產物: AC coverage 驗證 + checkpoint
 *
 * v5.0 變更：純 AC 驅動，廢棄 GEMS-TEST 分類 BLOCKER
 * - GEMS-TEST (Unit/Integration/E2E) 不再驅動任何 BLOCKER
 * - 唯一驗收機制：contract @GEMS-AC → 測試檔有 it('AC-X.Y')
 * - contract 不存在 → 跳過 AC 驗證，直接 PASS（靠人工 POC）
 * - DEPS-RISK 合理性仍然驗（外部依賴不能標 LOW）
 * - E2E/Integration/Unit 分類測試不再強制
 */
const fs = require('fs');
const path = require('path');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { writeCheckpoint } = require('../../lib/checkpoint.cjs');
const { scanGemsTags } = require('../../lib/scan/gems-scanner-unified.cjs');
const { handlePhaseSuccess } = require('../../lib/shared/error-handler.cjs');
const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');
const { emitPass, emitFix } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd } = require('../../lib/shared/next-command-helper.cjs');

function run(options) {

  console.log(getSimpleHeader('BUILD', 'Phase 4'));

  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';


  // 門控規格 v5.0 - 告訴 AI 這個 phase 會檢查什麼
  const gateSpec = {
    checks: [
      { name: 'contract 不存在 → 直接 PASS', desc: '無 contract = 無 AC = 不驗測試，靠人工 POC 驗收' },
      { name: "AC coverage: it('AC-X.Y')", desc: 'contract 有 @GEMS-AC → 測試檔必須有對應 it()' },
      { name: 'GEMS-DEPS-RISK 合理', desc: '外部依賴不能標 LOW（Phase 4 唯一保留的 DEPS 驗證）' },
      { name: 'GEMS-TEST 不再驅動 BLOCKER', desc: 'Unit/Integration/E2E 分類不強制，由 AC 驅動' }
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

  // v5.0: AC 驅動 — 從 contract 讀取 AC specs，決定要驗什麼
  const acCoverageResult = checkAcCoverage(scanResult.functions, srcPath, target, iteration);

  if (acCoverageResult.skipped) {
    // contract 不存在 or 無 @GEMS-AC → 沒有 AC 需要驗收，只驗 DEPS-RISK
    console.log(`[AC] contract 不存在或無 @GEMS-AC，跳過 AC coverage 檢查`);

    const riskIssues = checkRiskLevels(scanResult.functions);
    if (riskIssues.length === 0) {
      // 全部通過
      handlePhaseSuccess('BUILD', '4', story, target);
      writeCheckpoint(target, iteration, story, '4', {
        verdict: 'PASS', reason: 'no-ac-skip', riskIssues: 0
      });
      emitPass({
        scope: 'BUILD Phase 4',
        summary: `無 contract @GEMS-AC → 跳過 AC gate | DEPS-RISK: OK`,
        nextCmd: getNextCmd('BUILD', '4', { story, level, target: relativeTarget, iteration })
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'build', step: 'phase-4', story
      });
      return { verdict: 'PASS' };
    }
    // 有 DEPS-RISK 問題 → fall through to riskIssues BLOCKER below
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
      phase: 'build', step: 'phase-4', story
    });
    return { verdict: 'BLOCKER', reason: '風險等級錯誤' };
  }

  // 有 AC specs：檢查 coverage + DEPS-RISK
  const riskIssues = checkRiskLevels(scanResult.functions);
  console.log(`[AC] contract 有 ${acCoverageResult.total} 個 AC，已覆蓋 ${acCoverageResult.covered}`);
  if (acCoverageResult.gaps.length > 0) {
    console.log(`[AC] ${acCoverageResult.gaps.length} 個 AC 未被測試覆蓋`);
  }

  const passed = acCoverageResult.gaps.length === 0 && riskIssues.length === 0;

  // 通過
  if (passed) {
    handlePhaseSuccess('BUILD', '4', story, target);
    writeCheckpoint(target, iteration, story, '4', {
      verdict: 'PASS',
      acCoverage: { total: acCoverageResult.total, covered: acCoverageResult.covered },
      riskIssues: 0
    });
    emitPass({
      scope: 'BUILD Phase 4',
      summary: `AC coverage: ${acCoverageResult.covered}/${acCoverageResult.total} ✅ | DEPS-RISK: OK`,
      nextCmd: getNextCmd('BUILD', '4', { story, level, target: relativeTarget, iteration })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build', step: 'phase-4', story
    });
    return { verdict: 'PASS' };
  }

  // DEPS-RISK 錯誤 = BLOCKER
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
      phase: 'build', step: 'phase-4', story
    });
    return { verdict: 'BLOCKER', reason: '風險等級錯誤' };
  }

  // AC coverage gaps = BLOCKER
  if (acCoverageResult && !acCoverageResult.skipped && acCoverageResult.gaps.length > 0) {
    const { emitTaskBlock } = require('../../lib/shared/log-output.cjs');

    const tasks = acCoverageResult.gaps.slice(0, 8).map(gap => {
      const fn = scanResult.functions.find(f => f.name === gap.fn);
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

  // 以上已覆蓋所有情況（passed / riskIssues / acCoverageResult.gaps）
  // 不應到達此處，safety fallback
  return { verdict: 'PENDING' };
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
