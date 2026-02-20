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
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, anchorTemplatePending, saveLog, emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
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
    result.output = execSync(testCommand, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000 // 2 分鐘超時
    });
    result.success = true;

    // 即時輸出測試結果到 console（讓 IDE agent 看到）
    console.log(result.output);
  } catch (error) {
    result.success = false;
    result.output = (error.stdout || '') + '\n' + (error.stderr || '');
    result.error = error.message;

    // 即時輸出錯誤到 console（讓 IDE agent 看到）
    console.log(result.output);
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
 * 解析測試輸出的統計數據
 * @param {string} output - 測試輸出
 * @returns {object|null} 統計數據
 */
function parseTestStats(output) {
  // Jest 格式: Tests: 4 passed, 4 total
  const jestMatch = output.match(/Tests:\s+(\d+)\s+failed,?\s*(\d+)\s+passed,?\s*(\d+)\s+total/i);
  if (jestMatch) {
    return {
      failed: parseInt(jestMatch[1]),
      passed: parseInt(jestMatch[2]),
      total: parseInt(jestMatch[3])
    };
  }

  // Jest 全通過格式: Tests: 4 passed, 4 total
  const jestAllPass = output.match(/Tests:\s+(\d+)\s+passed,\s*(\d+)\s+total/i);
  if (jestAllPass) {
    return {
      passed: parseInt(jestAllPass[1]),
      total: parseInt(jestAllPass[2]),
      failed: 0
    };
  }

  // Vitest 格式
  const vitestMatch = output.match(/(\d+)\s+passed.*?(\d+)\s+failed/i);
  if (vitestMatch) {
    return {
      passed: parseInt(vitestMatch[1]),
      failed: parseInt(vitestMatch[2]),
      total: parseInt(vitestMatch[1]) + parseInt(vitestMatch[2])
    };
  }

  return null;
}




// ============================================
// 主函式
// ============================================

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
    anchorOutput({
      context: `Phase 5 | ${story}`,
      error: {
        type: 'BLOCKER',
        summary: '未找到測試檔案'
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=BUILD --step=2 --story=${story}`
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

    anchorOutput({
      context: `Phase 5 | ${story} | 測試環境未就緒`,
      info: {
        '測試框架': envInfo.testFramework || 'none',
        '已安裝': envInfo.frameworkInstalled ? '是' : '否',
        'Test Script': envInfo.hasTestScript ? '已配置' : '未配置'
      },
      error: {
        type: 'TACTICAL_FIX',
        summary: `測試環境問題: ${envInfo.issues.join(', ')}`
      },
      template: {
        title: 'INSTALL_HOOK',
        content: installGuide
      },
      task: [
        '執行安裝指令 (如需要)',
        '配置 package.json test script',
        '重新執行 Phase 5'
      ],
      output: `NEXT: ${getRetryCmd('BUILD', '5', { story })}`
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
  const testResult = executeTests(target, envInfo.testCommand || 'npm test', iteration, story, '3');

  // ========================================
  // Step 5: 儲存 LOG (通過/失敗都要)
  // ========================================
  // saveTestLog 已在 executeTests 中自動呼叫
  console.log(`[LOG] 測試記錄已儲存至 .gems/iterations/${iteration}/logs/`);

  // ========================================
  // Step 6: 結果處理
  // ========================================
  if (testResult.success) {
    handlePhaseSuccess('BUILD', '5', story);
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
      nextCmd: getNextCmd('BUILD', '5', { story, level })
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
    emitBlock({
      scope: `BUILD Phase 5 | ${story}`,
      summary: `TDD 測試需要進一步完善 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`,
      nextCmd: '建議：架構師協作，分析測試失敗原因',
      details: `Failed: ${testResult.stats.failed}/${testResult.stats.total}`
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

  anchorOutput({
    context: `Phase 5 | ${story} | TDD 測試失敗`,
    info: {
      'Log Dir': `.gems/iterations/${iteration}/logs/`,
      'Passed': testResult.stats.passed,
      'Failed': testResult.stats.failed,
      'Total': testResult.stats.total
    },
    error: {
      type: 'TACTICAL_FIX',
      summary: `測試未通過 | Failed: ${testResult.stats.failed}`,
      attempt,
      maxAttempts: MAX_ATTEMPTS
    },
    task: ['閱讀測試報告', '修正程式碼或測試', '重試'],
    template: {
      title: `TEST_ERROR (Recovery Level ${recoveryLevel})`,
      content: errorSummary || '無輸出'
    },
    output: `NEXT: ${getRetryCmd('BUILD', '5', { story })}`
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
    if (entry.isDirectory() && entry.name !== 'node_modules') {
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
