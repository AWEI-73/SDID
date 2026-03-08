#!/usr/bin/env node
/**
 * BUILD Phase 5: TDD 測試執行與環境管理
 * 輸入: 測試檔案 | 產物: 測試結果 + checkpoint + LOG
 * 
 * 新增功能 (v2.0):
 * 1. 測試環境偵測 - 檢查 Jest/Vitest/Mocha 是否安裝
 * 2. 環境安裝 HOOK - 提供安裝指引
 * 3. 執行測試 + LOG - 每次執行都輸出 LOG（通過/失敗都有）
 * 
 * 軍規 3: TDD 測試到 100%
 * - 測試必須呼叫真實函式
 * - 可 Mock 外部依賴 outcome
 * - 禁止在測試中重寫函式邏輯
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { writeCheckpoint } = require('../../lib/checkpoint.cjs');
const { createErrorHandler, handlePhaseSuccess, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { saveLog, emitPass, emitFix, emitFill, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd } = require('../../lib/shared/next-command-helper.cjs');


// ============================================
// 測試環境偵測
// ============================================

/**
 * 偵測專案的測試環境設定
 * @param {string} projectRoot - 專案根目錄
 * @returns {object} 環境狀態
 */
function detectTestEnvironment(projectRoot) {
  const result = {
    hasPackageJson: false,
    hasTestScript: false,
    testFramework: null,        // jest, vitest, mocha, none
    frameworkInstalled: false,
    testCommand: null,
    installCommand: null,
    issues: [],
    isReady: false
  };

  // 1. 檢查 package.json
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    result.issues.push('找不到 package.json');
    return result;
  }
  result.hasPackageJson = true;

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (e) {
    result.issues.push('package.json 解析失敗');
    return result;
  }

  // 2. 檢查 test script
  const testScript = pkg.scripts?.test || '';
  if (!testScript || testScript.includes('no test specified') || testScript.includes('exit 1')) {
    result.issues.push('未配置 test script');
  } else {
    result.hasTestScript = true;
    result.testCommand = 'npm test';
  }

  // 3. 偵測測試框架
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };

  if (allDeps.jest) {
    result.testFramework = 'jest';
    result.frameworkInstalled = true;
  } else if (allDeps.vitest) {
    result.testFramework = 'vitest';
    result.frameworkInstalled = true;
  } else if (allDeps.mocha) {
    result.testFramework = 'mocha';
    result.frameworkInstalled = true;
  } else {
    result.testFramework = 'none';
    result.issues.push('未安裝測試框架 (jest/vitest/mocha)');
  }

  // 4. 檢查是否為 ESM 專案
  const isESM = pkg.type === 'module';

  // 5. 設定安裝指令
  if (!result.frameworkInstalled) {
    if (isESM) {
      result.installCommand = 'npm install --save-dev jest @babel/preset-env babel-jest';
    } else {
      result.installCommand = 'npm install --save-dev jest';
    }
  }

  // 6. 如果有框架但沒有 test script，生成建議
  if (result.frameworkInstalled && !result.hasTestScript) {
    if (result.testFramework === 'jest') {
      if (isESM) {
        result.testCommand = 'node --experimental-vm-modules node_modules/jest/bin/jest.js';
      } else {
        result.testCommand = 'jest';
      }
    } else if (result.testFramework === 'vitest') {
      result.testCommand = 'vitest run';
    } else if (result.testFramework === 'mocha') {
      result.testCommand = 'mocha';
    }
  }

  // 7. 判斷是否準備就緒
  result.isReady = result.hasPackageJson && result.hasTestScript && result.frameworkInstalled;

  return result;
}


// ============================================
// 測試執行與 LOG
// ============================================

/**
 * 執行測試並捕捉輸出
 * @param {string} projectRoot - 專案根目錄
 * @param {string} testCommand - 測試指令 (預設 npm test)
 * @param {string} iteration - 迭代編號
 * @param {string} story - Story 編號
 * @param {string} phase - Phase 編號
 * @returns {object} 執行結果
 */
function executeTests(projectRoot, testCommand = 'npm test', iteration = 'iter-1', story = '', phase = '3') {
  const result = {
    success: false,
    output: '',
    error: null,
    duration: 0,
    stats: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };

  const startTime = Date.now();

  console.log('\n' + '='.repeat(80));
  console.log('🧪 執行測試...');
  console.log('='.repeat(80));

  try {
    // Jest 預設把輸出寫到 stderr，所以必須同時捕捉 stderr
    // 用 shell redirect 合併 stderr → stdout
    const shellCmd = process.platform === 'win32'
      ? `${testCommand} 2>&1`
      : `${testCommand} 2>&1`;
    result.output = execSync(shellCmd, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000, // 2 分鐘超時
      shell: true
    });
    result.success = true;

    // 完整輸出只存 result.output，終端機只印摘要（PASS 行 + 統計）
    const passLines = result.output.split('\n').filter(l => /^(PASS|✓)\s/.test(l));
    if (passLines.length > 0) console.log(passLines.join('\n'));
  } catch (error) {
    result.success = false;
    result.output = (error.stdout || '') + (error.stderr || '');
    result.error = error.message;

    // 完整輸出存 log，終端機只印失敗的檔案行（FAIL xxx.test.ts），不印 stack trace
    const failLines = result.output.split('\n').filter(l => /^(FAIL|✕|×)\s/.test(l));
    if (failLines.length > 0) {
      console.log(failLines.join('\n'));
    } else {
      // 找不到 FAIL 行時才印最後 10 行（避免完全沒資訊）
      const last10 = result.output.split('\n').filter(l => l.trim()).slice(-10);
      console.log(last10.join('\n'));
    }
    console.log('↳ 完整錯誤詳情已存入 log 檔，請讀取 @READ_FIRST 指定的 log');
  }

  result.duration = Date.now() - startTime;

  // 嘗試解析測試統計
  const stats = parseTestStats(result.output);
  if (stats) {
    result.stats = stats;
  }

  console.log('='.repeat(80));
  console.log(`⏱️  執行時間: ${result.duration}ms`);
  console.log(`📊 統計: ${result.stats.passed} passed / ${result.stats.failed} failed / ${result.stats.total} total`);
  console.log('='.repeat(80) + '\n');

  // 儲存測試 log（使用 saveLog 工具）
  saveTestLogToFile(projectRoot, iteration, story, phase, result);

  return result;
}

/**
 * 儲存測試 log 到 .gems/iterations/iter-X/logs/（使用 saveLog 工具）
 * @param {string} projectRoot - 專案根目錄
 * @param {string} iteration - 迭代編號
 * @param {string} story - Story 編號
 * @param {string} phase - Phase 編號
 * @param {object} testResult - 測試結果
 */
function saveTestLogToFile(projectRoot, iteration, story, phase, testResult) {
  const iterNum = typeof iteration === 'string' ? parseInt(iteration.replace('iter-', '')) : iteration;

  // 產生精簡的 log 內容
  const logContent = generateTestLogContent(testResult, story, phase);

  // 使用 saveLog 工具儲存
  try {
    const logPath = saveLog({
      projectRoot,
      iteration: iterNum,
      phase: 'build',
      step: `phase-${phase}`,
      story,
      type: testResult.success ? 'test-pass' : 'test-fail',
      content: logContent
    });

    console.log(`📝 測試 log 已儲存: ${logPath}`);
  } catch (err) {
    console.error(`⚠️  儲存測試 log 失敗: ${err.message}`);
  }
}

/**
 * 產生精簡的測試 log 內容（只記錄錯誤）
 * @param {object} testResult - 測試結果
 * @param {string} story - Story 編號
 * @param {string} phase - Phase 編號
 * @returns {string} log 內容
 */
function generateTestLogContent(testResult, story, phase) {
  const lines = [];

  lines.push('='.repeat(80));
  lines.push(`測試執行報告 - ${story} Phase ${phase}`);
  lines.push('='.repeat(80));
  lines.push(`時間: ${new Date().toISOString()}`);
  lines.push(`執行時間: ${testResult.duration}ms`);
  lines.push(`結果: ${testResult.success ? '✅ PASS' : '❌ FAIL'}`);
  lines.push('');

  // 統計資訊
  lines.push('統計:');
  lines.push(`  總測試數: ${testResult.stats.total}`);
  lines.push(`  通過: ${testResult.stats.passed}`);
  lines.push(`  失敗: ${testResult.stats.failed}`);
  lines.push('');

  // 只記錄錯誤（精簡模式）
  if (!testResult.success) {
    lines.push('='.repeat(80));
    lines.push('❌ 錯誤詳情');
    lines.push('='.repeat(80));
    lines.push('');

    // 提取失敗的測試
    const failedTests = extractFailedTests(testResult.output);
    if (failedTests.length > 0) {
      failedTests.forEach((test, index) => {
        lines.push(`${index + 1}. ${test.name}`);
        lines.push(`   檔案: ${test.file}`);
        lines.push(`   錯誤: ${test.error}`);
        lines.push('');
      });
    } else {
      // 如果無法解析，輸出原始錯誤（限制長度）
      const errorLines = testResult.output.split('\n').filter(l => l.trim() !== '');
      const relevantLines = errorLines.slice(-50); // 只保留最後 50 行
      lines.push(relevantLines.join('\n'));
    }
  } else {
    lines.push('✅ 所有測試通過');
  }

  lines.push('');
  lines.push('='.repeat(80));

  return lines.join('\n');
}

/**
 * 從測試輸出中提取失敗的測試
 * @param {string} output - 測試輸出
 * @returns {Array} 失敗的測試列表
 */
function extractFailedTests(output) {
  const failedTests = [];

  // Jest 格式
  const jestFailPattern = /● (.+?)\n\n\s+(.+?)\n\n\s+(.+?)(?=\n\n|$)/gs;
  let match;
  while ((match = jestFailPattern.exec(output)) !== null) {
    failedTests.push({
      name: match[1].trim(),
      file: match[2].trim(),
      error: match[3].trim().substring(0, 200) // 限制錯誤訊息長度
    });
  }

  // Vitest 格式
  if (failedTests.length === 0) {
    const vitestFailPattern = /FAIL\s+(.+?)\n(.+?)(?=\nFAIL|\n\n|$)/gs;
    while ((match = vitestFailPattern.exec(output)) !== null) {
      failedTests.push({
        name: match[1].trim(),
        file: match[1].trim(),
        error: match[2].trim().substring(0, 200)
      });
    }
  }

  return failedTests;
}

/**
 * 從測試輸出抓取真正失敗的測試檔案路徑
 * Jest:   "FAIL src/config/__tests__/foo.test.ts"
 * Vitest: "❯ src/config/__tests__/foo.test.ts"
 */
function extractFailedFiles(output, target) {
  const files = new Set();

  // Jest: FAIL src/...
  const jestPattern = /^(?:FAIL|✕)\s+(.+\.(?:test|spec)\.[jt]sx?)$/gm;
  let m;
  while ((m = jestPattern.exec(output)) !== null) {
    files.add(m[1].trim());
  }

  // Vitest: ❯ src/... (failed)
  const vitestPattern = /^[❯✗×]\s+(.+\.(?:test|spec)\.[jt]sx?)/gm;
  while ((m = vitestPattern.exec(output)) !== null) {
    files.add(m[1].trim());
  }

  return [...files];
}

/**
 * 解析測試輸出的統計數據
 * @param {string} output - 測試輸出
 * @returns {object|null} 統計數據
 */
function parseTestStats(output) {
  // Strip ANSI escape codes 避免色碼夾在數字裡導致 regex 失效
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');

  // Jest 格式: Tests: 4 passed, 4 total
  const jestMatch = clean.match(/Tests:\s+(\d+)\s+failed,?\s*(\d+)\s+passed,?\s*(\d+)\s+total/i);
  if (jestMatch) {
    return {
      failed: parseInt(jestMatch[1]),
      passed: parseInt(jestMatch[2]),
      total: parseInt(jestMatch[3])
    };
  }

  // Jest 全通過格式: Tests: 4 passed, 4 total
  const jestAllPass = clean.match(/Tests:\s+(\d+)\s+passed,\s*(\d+)\s+total/i);
  if (jestAllPass) {
    return {
      passed: parseInt(jestAllPass[1]),
      total: parseInt(jestAllPass[2]),
      failed: 0
    };
  }

  // Vitest 格式: "Tests  12 passed (12)" 或 "Tests  2 failed | 10 passed (12)"
  // 注意: Vitest 用多個空格，且結尾有 (total)
  const vitestTotalMatch = clean.match(/Tests\s+.*?\((\d+)\)/i);
  if (vitestTotalMatch) {
    const total = parseInt(vitestTotalMatch[1]);
    const vitestPassedMatch = clean.match(/Tests\s+.*?(\d+)\s+passed/i);
    const vitestFailedMatch = clean.match(/Tests\s+.*?(\d+)\s+failed/i);
    const passed = vitestPassedMatch ? parseInt(vitestPassedMatch[1]) : 0;
    const failed = vitestFailedMatch ? parseInt(vitestFailedMatch[1]) : 0;
    return { passed, failed, total };
  }

  // Vitest 舊格式 (無括號): "Tests  12 passed"
  const vitestMatch = clean.match(/Tests\s+(\d+)\s+passed/i);
  if (vitestMatch) {
    const failedMatch = clean.match(/(\d+)\s+failed/i);
    const passed = parseInt(vitestMatch[1]);
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
    return {
      passed,
      failed,
      total: passed + failed
    };
  }

  return null;
}




// ============================================
// 主函式
// ============================================

// ============================================
// Stub 偵測 — 掃描測試檔案品質
// ============================================

/**
 * 偵測 stub 測試：只有 toBeDefined()/toBeTruthy() 的 test case
 * 同時偵測 hardcoded-false：toBe(false) 作為唯一斷言（debug 殘留）
 * @param {string[]} testFiles - 測試檔案路徑列表
 * @param {string} projectRoot - 專案根目錄
 * @returns {Array} stub issues
 */
function detectTestStubs(testFiles, projectRoot) {
  const issues = [];
  const WEAK_ONLY = /expect\([\s\S]*?\)\.(toBeDefined|toBeTruthy|not\.toBeUndefined|not\.toBeNull)\(\)/g;
  const VALID_ASSERT = /expect\([\s\S]*?\)\.(toBe|toEqual|toContain|toHaveLength|toMatchObject|toHaveBeenCalledWith|toThrow|toHaveProperty|toMatch)\(/;
  // 偵測 hardcoded false：toBe(false) / toEqual(false) 作為斷言（debug 殘留）
  const HARDCODED_FALSE = /expect\([\s\S]*?\)\.(toBe|toEqual)\(\s*false\s*\)/;

  for (const file of testFiles) {
    const absFile = path.isAbsolute(file) ? file : path.join(projectRoot, file);
    if (!fs.existsSync(absFile)) continue;

    let content;
    try { content = fs.readFileSync(absFile, 'utf8'); } catch { continue; }

    // 提取每個 it/test block
    const testBlocks = content.match(/(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{[^}]*\}/g);
    if (!testBlocks) continue;

    for (const block of testBlocks) {
      const nameMatch = block.match(/(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/);
      const testName = nameMatch ? nameMatch[1] : '(unnamed)';

      const hasWeak = WEAK_ONLY.test(block);
      WEAK_ONLY.lastIndex = 0;
      const hasValid = VALID_ASSERT.test(block);
      const hasHardcodedFalse = HARDCODED_FALSE.test(block);

      // 嘗試從 import 推斷被測函式（排除 test framework imports）
      const imports = [...content.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)];
      const appImport = imports.find(m => !m[2].match(/^(vitest|jest|@jest|@testing-library)/));
      const fnName = appImport ? appImport[1].trim().split(',')[0].trim() : null;

      if (hasWeak && !hasValid) {
        issues.push({
          file: path.relative(projectRoot, absFile),
          testName,
          fnName,
          reason: '只有 toBeDefined/toBeTruthy，無實質行為驗證',
          type: 'STUB'
        });
      } else if (hasHardcodedFalse && !block.includes('// intentional') && !block.includes('// expected false')) {
        // hardcoded false 且沒有明確標注「預期為 false」的 comment
        issues.push({
          file: path.relative(projectRoot, absFile),
          testName,
          fnName,
          reason: '@SUSPICIOUS_ASSERT: toBe(false) 可能是 debug 殘留，請確認是否為預期行為',
          type: 'SUSPICIOUS'
        });
      }
    }
  }

  return issues;
}

function run(options) {

  console.log(getSimpleHeader('BUILD', 'Phase 5'));

  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';

  const iterNum = parseInt(iteration.replace('iter-', ''));

  // 門控規格 - 告訴 AI 這個 phase 會檢查什麼
  const gateSpec = {
    checks: [
      { name: '測試檔案存在', pattern: '*.test.ts', desc: '至少有一個測試檔案' },
      { name: '測試框架安裝', pattern: 'jest|vitest|mocha', desc: 'package.json 有測試框架' },
      { name: 'test script 配置', pattern: 'npm test', desc: 'package.json scripts.test 有效' },
      { name: '測試全部通過', pattern: '0 failed', desc: '所有測試案例通過' }
    ]
  };

  if (!story) {
    emitFix({
      scope: 'BUILD Phase 5',
      summary: '缺少 --story 參數',
      targetFile: 'CLI 參數',
      missing: ['--story 參數'],
      example: `node task-pipe/runner.cjs --phase=BUILD --step=5 --story=Story-1.0 --target=${relativeTarget}`,
      nextCmd: 'node task-pipe/runner.cjs --phase=BUILD --step=5 --story=Story-X.Y',
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      phase: 'build',
      step: 'phase-5',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  const errorHandler = createErrorHandler('BUILD', '5', story);
  const { type: projectType } = detectProjectType(target);
  const srcPath = getSrcDir(target, projectType);
  const testFiles = findTestFiles(srcPath);

  // ========================================
  // Step 1: 檢查測試檔案存在
  // ========================================
  if (testFiles.length === 0) {
    emitBlock({
      scope: `BUILD Phase 5 | ${story}`,
      summary: '未找到測試檔案，請先執行 Phase 3 建立測試',
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=3 --story=${story} --target=${relativeTarget}`,
      tasks: [{
        action: 'CHECK_PHASE_3',
        file: `src/**/__tests__/*.test.ts`,
        expected: 'Phase 3 應已建立測試檔案，確認 src 目錄下有 *.test.ts'
      }]
    }, {
      projectRoot: target,
      iteration: iterNum,
      phase: 'build',
      step: 'phase-5',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // ========================================
  // Step 2: 測試環境偵測
  // ========================================
  const envInfo = detectTestEnvironment(target);

  console.log(`[ENV] 測試框架: ${envInfo.testFramework || 'none'}`);
  console.log(`[ENV] 框架已安裝: ${envInfo.frameworkInstalled}`);
  console.log(`[ENV] Test Script: ${envInfo.hasTestScript}`);
  console.log(`[ENV] 環境就緒: ${envInfo.isReady}`);

  // ========================================
  // Step 3: 環境安裝 HOOK
  // ========================================
  if (!envInfo.isReady) {
    // 產生安裝指引
    const installGuide = generateInstallGuide(envInfo, target);

    emitFill({
      scope: `BUILD Phase 5 | ${story}`,
      summary: `測試環境問題: ${envInfo.issues.join(', ')}`,
      targetFile: 'package.json / jest.config.js',
      fillItems: [
        '執行安裝指令 (如需要)',
        '配置 package.json test script',
        '重新執行 Phase 5'
      ],
      nextCmd: getRetryCmd('BUILD', '5', { story, target: relativeTarget, iteration }),
      templateContent: installGuide,
    }, {
      projectRoot: target,
      iteration: iterNum,
      phase: 'build',
      step: 'phase-5',
      story
    });

    return { verdict: 'PENDING', reason: 'env_not_ready', envInfo };
  }

  // ========================================
  // Step 4: 執行測試
  // ========================================
  console.log(`[RUN] 執行測試: ${envInfo.testCommand || 'npm test'}`);
  const testResult = executeTests(target, envInfo.testCommand || 'npm test', iteration, story, '5');

  // ========================================
  // Step 5: 儲存 LOG (通過/失敗都要)
  // ========================================
  // saveTestLog 已在 executeTests 中自動呼叫
  console.log(`[LOG] 測試記錄已儲存至 .gems/iterations/${iteration}/logs/`);

  // ========================================
  // Step 6: 結果處理
  // ========================================
  if (testResult.success) {
    // NOTICE-002 修復: total=0 表示 jest 沒找到測試，不應靜默 PASS
    if (testResult.stats.total === 0 && testFiles.length > 0) {
      const attempt = errorHandler.recordError('E7', 'jest 執行成功但 0 個測試被執行');
      emitFix({
        scope: `BUILD Phase 5 | ${story}`,
        summary: `jest 跑完但 0 個測試被執行 (找到 ${testFiles.length} 個測試檔案)`,
        targetFile: 'jest.config.js / package.json',
        missing: ['testMatch 設定', 'ts-jest transform'],
        example: [
          '// jest.config.js',
          'module.exports = {',
          "  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],",
          "  transform: { '^.+\\.tsx?$': 'ts-jest' }",
          '};',
          '',
          '// 確認 jest 能找到測試:',
          'npx jest --listTests'
        ].join('\n'),
        nextCmd: getRetryCmd('BUILD', '5', { story, target: relativeTarget, iteration }),
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        tasks: [{
          action: 'FIX_JEST_CONFIG',
          file: 'jest.config.js',
          expected: `testMatch 必須能匹配到 ${testFiles.length} 個測試檔案，執行 npx jest --listTests 確認`
        }]
      }, {
        projectRoot: target,
        iteration: iterNum,
        phase: 'build',
        step: 'phase-5',
        story
      });
      return { verdict: 'PENDING', reason: 'no_tests_executed', testFiles: testFiles.length };
    }

    handlePhaseSuccess('BUILD', '5', story, target);

    // ========================================
    // Step 6.1: Stub 偵測 — 掃描測試品質
    // ========================================
    const stubIssues = detectTestStubs(testFiles, target);
    if (stubIssues.length > 0) {
      // 分類：STUB vs SUSPICIOUS
      const realStubs = stubIssues.filter(s => s.type === 'STUB');
      const suspicious = stubIssues.filter(s => s.type === 'SUSPICIOUS');
      const attempt = errorHandler.recordError('STUB', stubIssues.length + ' 個測試品質問題');

      const taskDetails = stubIssues.slice(0, 8).map(s => {
        let srcSnippet = '';
        if (s.fnName) {
          const testAbsPath = path.isAbsolute(s.file) ? s.file : path.join(target, s.file);
          try {
            const testContent = fs.readFileSync(testAbsPath, 'utf8');
            // 用字串拼接避免 regex escape 問題
            const pat = 'import\\s*\\{[^}]*' + s.fnName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '[^}]*\\}\\s*from\\s*[\'"]([\'"^]+)[\'"]';
            const fromMatch = testContent.match(new RegExp(pat));
            if (fromMatch) {
              const importPath = fromMatch[1];
              const testDir = path.dirname(testAbsPath);
              const candidates = [
                path.resolve(testDir, importPath + '.ts'),
                path.resolve(testDir, importPath + '.tsx'),
                path.resolve(testDir, importPath, 'index.ts'),
                path.resolve(testDir, importPath + '.js'),
              ];
              for (const candidate of candidates) {
                if (fs.existsSync(candidate)) {
                  srcSnippet = fs.readFileSync(candidate, 'utf8').split('\n').slice(0, 20).join('\n');
                  break;
                }
              }
            }
          } catch { /* 忽略 */ }
        }
        return Object.assign({}, s, { srcSnippet });
      });

      const summaryParts = [];
      if (realStubs.length > 0) summaryParts.push(realStubs.length + ' 個 STUB（toBeDefined/toBeTruthy）');
      if (suspicious.length > 0) summaryParts.push(suspicious.length + ' 個 @SUSPICIOUS_ASSERT（toBe(false) 可能是 debug 殘留）');

      const detailLines = [];
      if (realStubs.length > 0) {
        detailLines.push('=== STUB 定義 ===');
        detailLines.push('STUB 測試 = 只用 toBeDefined()/toBeTruthy() 確認「東西存在」，不驗證任何行為。');
        detailLines.push('❌ BEFORE (stub): expect(MyFunc).toBeDefined()');
        detailLines.push('✅ AFTER (real):  expect(MyFunc()).toEqual({ key: "value" })');
        detailLines.push('');
      }
      if (suspicious.length > 0) {
        detailLines.push('=== @SUSPICIOUS_ASSERT ===');
        detailLines.push('toBe(false) 作為斷言通常是 debug 殘留（故意讓測試失敗）。');
        detailLines.push('如果這是預期行為，在該行加 // expected false 或 // intentional 來消除警告。');
        detailLines.push('❌ SUSPICIOUS: expect(isValid(obj)).toBe(false) // 故意製造錯誤');
        detailLines.push('✅ 修復: expect(isValid(obj)).toBe(true)  // 或加 // expected false 說明原因');
        detailLines.push('');
      }
      detailLines.push('=== 被標記的測試 ===');
      taskDetails.forEach(function(s, i) {
        const tag = s.type === 'SUSPICIOUS' ? '[SUSPICIOUS]' : '[STUB]';
        detailLines.push((i + 1) + '. ' + tag + ' ' + s.file + ' → it(\'' + s.testName + '\')');
        detailLines.push('   原因: ' + s.reason);
        detailLines.push('   被測函式: ' + (s.fnName || '(請從 import 推斷)'));
        if (s.srcSnippet) detailLines.push('   原始碼摘要:\n   ' + s.srcSnippet.split('\n').slice(0, 5).join('\n   '));
      });

      emitBlock({
        scope: 'BUILD Phase 5 | ' + story,
        summary: '測試品質問題: ' + summaryParts.join(' | '),
        context: 'Phase 5 | ' + story + ' | Stub 偵測',
        details: detailLines.join('\n'),
        tasks: taskDetails.map(function(s) {
          return {
            action: s.type === 'SUSPICIOUS' ? 'FIX_SUSPICIOUS_ASSERT' : 'REWRITE_TEST',
            file: s.file,
            expected: s.type === 'SUSPICIOUS'
              ? '確認 toBe(false) 是否為預期行為。若是 debug 殘留請改為 toBe(true)；若確實預期 false 請加 // expected false 說明。'
              : '呼叫 ' + (s.fnName || '被測函式') + '() 並用 toBe/toEqual/toContain 驗證回傳值。不要只檢查存在性。',
            reference: s.srcSnippet
              ? '原始碼前 5 行:\n' + s.srcSnippet.split('\n').slice(0, 5).join('\n')
              : '函式: ' + (s.fnName || '(unknown)')
          };
        }),
        forbidden: [
          '禁止用 toBeDefined()/toBeTruthy()/not.toBeNull() 作為唯一斷言',
          '禁止辯稱「這不是 stub」— 門控已自動掃描確認，只有 toBeDefined/toBeTruthy 的 test case 就是 stub',
          '每個 test case 必須呼叫函式並驗證回傳值或副作用'
        ],
        nextCmd: getRetryCmd('BUILD', '5', { story: story, target: relativeTarget, iteration: iteration }),
        attempt: attempt,
        maxAttempts: MAX_ATTEMPTS
      }, {
        projectRoot: target,
        iteration: iterNum,
        phase: 'build',
        step: 'phase-5',
        story: story
      });
      return { verdict: 'BLOCKER', reason: 'stub_tests', count: stubIssues.length };
    }

    // ========================================
    // Step 6.2: AC 機械驗收（ac-runner）
    // 在 npm test 通過 + stub 掃描通過後，再跑純計算函式的行為驗收
    // ========================================
    const acRunnerPath = path.resolve(__dirname, '..', '..', '..', 'sdid-tools', 'ac-runner.cjs');
    const contractPath = path.join(target, '.gems', 'iterations', `iter-${iterNum}`, 'poc', `contract_iter-${iterNum}.ts`);

    if (fs.existsSync(acRunnerPath) && fs.existsSync(contractPath)) {
      console.log('\n[AC] 執行 AC 機械驗收...');
      let acOutput = '';
      let acPass = false;
      try {
        acOutput = execSync(
          `node "${acRunnerPath}" --contract="${contractPath}" --target="${target}" --iter=${iterNum}`,
          { encoding: 'utf8', cwd: target, stdio: 'pipe' }
        );
        acPass = true;
      } catch (e) {
        acOutput = (e.stdout || '') + (e.stderr || '');
        acPass = false;
      }
      console.log(acOutput);

      if (!acPass) {
        const attempt = errorHandler.recordError('AC', 'AC 機械驗收失敗');
        emitBlock({
          scope: `BUILD Phase 5 | ${story}`,
          summary: `AC 機械驗收失敗 — 純計算函式回傳值與 contract.ts @GEMS-AC-EXPECT 不符`,
          context: `contract: ${path.relative(target, contractPath)}`,
          details: acOutput.split('\n').slice(-20).join('\n'),
          nextCmd: getRetryCmd('BUILD', '5', { story, target: relativeTarget, iteration }),
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          forbidden: [
            '禁止修改 contract.ts 的 @GEMS-AC-EXPECT（Gate 鎖定的規格）',
            '禁止修改 @GEMS-AC-INPUT（Gate 鎖定的測試案例）',
            '只能修改 src/ 下的函式實作'
          ]
        }, {
          projectRoot: target,
          iteration: iterNum,
          phase: 'build',
          step: 'phase-5',
          story
        });
        return { verdict: 'BLOCKER', reason: 'ac_runner_fail' };
      }
    } else if (fs.existsSync(acRunnerPath) && !fs.existsSync(contractPath)) {
      console.log(`[AC] 跳過 AC 驗收（contract 不存在: .gems/iterations/iter-${iterNum}/poc/contract_iter-${iterNum}.ts）`);
    }

    writeCheckpoint(target, iteration, story, '5', {
      verdict: 'PASS',
      testFiles: testFiles.length,
      passRate: 100,
      stats: testResult.stats,
      duration: testResult.duration
    });

    const statsInfo = testResult.stats.total > 0
      ? `${testResult.stats.passed}/${testResult.stats.total} passed`
      : `${testFiles.length} test files`;

    emitPass({
      scope: 'BUILD Phase 5',
      summary: `測試通過 ✅ | ${statsInfo} | ${testResult.duration}ms`,
      nextCmd: getNextCmd('BUILD', '5', { story, level, target: relativeTarget, iteration })
    }, {
      projectRoot: target,
      iteration: iterNum,
      phase: 'build',
      step: 'phase-5',
      story
    });
    return { verdict: 'PASS' };
  }

  // ========================================
  // 測試失敗處理
  // ========================================
  const attempt = errorHandler.recordError('E7', '測試未通過');

  // 超過重試上限
  if (errorHandler.shouldBlock()) {
    const failStats = testResult.stats.total === 0
      ? `測試執行了 0 個 (jest 找不到測試或設定錯誤)`
      : `Failed: ${testResult.stats.failed}/${testResult.stats.total}`;

    const blockTasks = testResult.stats.total === 0
      ? [{
          action: 'CHECK_JEST_CONFIG',
          file: 'jest.config.js / package.json',
          expected: '確認 testMatch 包含測試檔案路徑，執行 npx jest --listTests 確認 jest 能找到測試',
          reference: `找到 ${testFiles.length} 個測試檔案但 jest 執行了 0 個`
        }]
      : extractFailedFiles(testResult.output, target).slice(0, 5).map(f => ({
          action: 'FIX_TEST',
          file: f,
          expected: '修正測試失敗原因，確保測試通過',
          reference: `測試失敗: ${testResult.stats.failed} 個`
        })) || testFiles.slice(0, 5).map(f => ({
          action: 'FIX_TEST',
          file: path.relative(target, f),
          expected: '修正測試失敗原因，確保測試通過',
          reference: `測試失敗: ${testResult.stats.failed} 個`
        }));

    emitBlock({
      scope: `BUILD Phase 5 | ${story}`,
      summary: `TDD 測試連續失敗 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS}) — ${failStats}`,
      nextCmd: getRetryCmd('BUILD', '5', { story, target: relativeTarget, iteration }),
      details: [
        `=== 測試統計 ===`,
        failStats,
        ``,
        `=== 測試輸出 (最後 30 行) ===`,
        testResult.output.split('\n').filter(l => l.trim()).slice(-30).join('\n') || '(無輸出)'
      ].join('\n'),
      tasks: blockTasks,
    }, {
      projectRoot: target,
      iteration: iterNum,
      phase: 'build',
      step: 'phase-5',
      story
    });
    return { verdict: 'BLOCKER', reason: 'tactical_fix_limit' };
  }

  const recoveryLevel = errorHandler.getRecoveryLevel();

  // 讀取最後 30 行錯誤訊息作為摘要
  const errorSummary = testResult.output
    .split('\n')
    .filter(l => l.trim() !== '')
    .slice(-30)
    .join('\n');

  emitFix({
    scope: `BUILD Phase 5 | ${story}`,
    summary: `測試未通過 | Failed: ${testResult.stats.failed}/${testResult.stats.total}`,
    targetFile: '測試檔案 (見 @READ log)',
    missing: [`${testResult.stats.failed} 個測試失敗`],
    nextCmd: getRetryCmd('BUILD', '5', { story, target: relativeTarget, iteration }),
    attempt,
    maxAttempts: MAX_ATTEMPTS,
    example: errorSummary || '(無輸出)',
  }, {
    projectRoot: target,
    iteration: iterNum,
    phase: 'build',
    step: 'phase-5',
    story
  });

  return { verdict: 'PENDING', testFiles, attempt };
}


// ============================================
// 輔助函式
// ============================================

/**
 * 產生環境安裝指引
 */
function generateInstallGuide(envInfo, projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (e) { }

  const isESM = pkg.type === 'module';
  const lines = [];

  lines.push('# 測試環境安裝指引\n');

  if (!envInfo.frameworkInstalled) {
    lines.push('## 1. 安裝 Jest\n');
    if (isESM) {
      lines.push('```bash');
      lines.push('npm install --save-dev jest @babel/preset-env babel-jest');
      lines.push('```\n');
      lines.push('## 2. 建立 babel.config.cjs\n');
      lines.push('```javascript');
      lines.push('module.exports = {');
      lines.push("  presets: [['@babel/preset-env', { targets: { node: 'current' } }]]");
      lines.push('};');
      lines.push('```\n');
    } else {
      lines.push('```bash');
      lines.push('npm install --save-dev jest');
      lines.push('```\n');
    }
  }

  if (!envInfo.hasTestScript) {
    lines.push('## 3. 配置 package.json test script\n');
    lines.push('```json');
    lines.push('"scripts": {');
    if (isESM) {
      lines.push('  "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"');
    } else {
      lines.push('  "test": "jest"');
    }
    lines.push('}');
    lines.push('```\n');
  }

  lines.push('## 完成後執行');
  lines.push('```bash');
  lines.push('npm test');
  lines.push('```');

  return lines.join('\n');
}

function findTestFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.gems' && entry.name !== 'backups') {
      findTestFiles(fullPath, files);
    } else if (entry.isFile() && /\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
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

module.exports = { run, detectTestEnvironment, executeTests };
