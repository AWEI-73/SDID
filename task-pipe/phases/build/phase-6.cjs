#!/usr/bin/env node
/**
 * BUILD Phase 6: 修改檔案測試驗證
 * 輸入: 修改過的檔案 | 產物: 對應測試全部通過 + checkpoint
 * 
 * 軍規 5: 小跑修正 → SEARCH → 修正 → 重試，最多 3 次
 * 軍規 6: 修改檔案必須測試 → 跳過測試 = BUILD 無效
 * 
 * 驗證流程 (modifiedFileTestRules):
 * 1. extract-gems-tags: 從修改檔案提取 GEMS 標籤
 * 2. filter-by-priority: 只處理 P0/P1
 * 3. extract-test-file: 提取 GEMS-TEST-FILE
 */
const fs = require('fs');
const path = require('path');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { writeCheckpoint } = require('../../lib/checkpoint.cjs');
const { createErrorHandler, handlePhaseSuccess, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd, getPassCmd } = require('../../lib/shared/next-command-helper.cjs');

function run(options) {

  console.log(getSimpleHeader('BUILD', 'Phase 6'));

  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';


  // 門控規格 - 告訴 AI 這個 phase 會檢查什麼
  const gateSpec = {
    checks: [
      { name: '修改檔案有測試', pattern: 'GEMS-TEST-FILE 指定', desc: '每個修改的檔案都有對應測試' },
      { name: 'Integration 測試真實', pattern: '禁止 mock 核心邏輯', desc: '整合測試使用真實依賴' },
      { name: 'P0 有 E2E 覆蓋', pattern: 'E2E 測試通過', desc: 'P0 函式的 E2E 測試必須通過' },
      { name: '測試全部通過', pattern: 'npm test PASS', desc: '修改檔案的測試全部通過' }
    ]
  };

  if (!story) {
    emitFix({
      scope: 'BUILD Phase 6',
      summary: '缺少 --story 參數',
      targetFile: 'CLI 參數',
      missing: ['--story 參數'],
      example: `node task-pipe/runner.cjs --phase=BUILD --step=6 --story=Story-1.0 --target=${relativeTarget}`,
      nextCmd: 'node task-pipe/runner.cjs --phase=BUILD --step=6 --story=Story-X.Y',
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      phase: 'build',
      step: 'phase-6',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // 建立錯誤處理器
  const errorHandler = createErrorHandler('BUILD', '6', story);

  // 偵測專案類型並取得源碼目錄
  const { type: projectType } = detectProjectType(target);
  const srcPath = getSrcDir(target, projectType);
  const testFiles = findTestFiles(srcPath);

  if (!fs.existsSync(srcPath)) {
    emitFix({
      scope: `BUILD Phase 6 | ${story}`,
      summary: '源碼目錄不存在',
      targetFile: srcPath,
      missing: ['源碼目錄'],
      example: `# 請先完成 Phase 1-5
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story} --target=${relativeTarget}`,
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story}`,
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-6',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // 如果有 --pass 參數，寫入 checkpoint
  if (process.argv.includes('--pass')) {
    // ============================================
    // 可選：代碼質量驗證（8 層核心驗證）
    // ============================================
    try {
      const { isSecurityCheckEnabled } = require('../../lib/security-checker.cjs');
      const { validateCode } = require('../../lib/build/code-validator.cjs');

      if (isSecurityCheckEnabled()) {
        console.log('\n[代碼質量驗證] 執行中...\n');

        // 找出修改的檔案
        const modifiedFiles = findModifiedFiles(srcPath);

        if (modifiedFiles.length > 0) {
          let hasIssues = false;

          for (const file of modifiedFiles) {
            const result = validateCode(file, {
              enableGems: true,
              enableSecurity: true,
              verbose: false
            });

            if (!result.passed && result.summary.critical > 0) {
              console.log(`❌ ${result.file}: 發現 ${result.summary.critical} 個嚴重問題`);
              result.criticalIssues.forEach(issue => console.log(`   - ${issue}`));
              hasIssues = true;
            } else if (!result.passed) {
              console.log(`⚠️  ${result.file}: 發現 ${result.summary.warnings} 個警告`);
            } else {
              console.log(`✅ ${result.file}: 通過驗證`);
            }
          }

          if (hasIssues) {
            console.log('\n[代碼質量驗證] 發現嚴重問題，建議修正後再繼續\n');
          } else {
            console.log('\n[代碼質量驗證] 通過\n');
          }
        }
      }
    } catch (err) {
      // 驗證失敗不影響主流程
      console.log(`[代碼質量驗證] 跳過: ${err.message}\n`);
    }

    handlePhaseSuccess('BUILD', '6', story);
    writeCheckpoint(target, iteration, story, '6', {
      verdict: 'PASS',
      testFiles: testFiles.length
    });

    emitPass({
      scope: 'BUILD Phase 6',
      summary: `修改檔案測試通過 | 測試檔案: ${testFiles.length}`,
      nextCmd: getNextCmd('BUILD', '6', { story, level })
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-6',
      story
    });
    return { verdict: 'PASS' };
  }

  // 記錄錯誤（每次執行都要記錄，才會累積計數）
  const attempt = errorHandler.recordError('E7', '修改檔案測試未通過');

  // 檢查是否超過重試上限
  if (errorHandler.shouldBlock()) {
    emitBlock({
      scope: `BUILD Phase 6 | ${story}`,
      summary: `修改檔案測試需要進一步完善 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`,
      nextCmd: '建議：架構師協作，分析測試失敗原因'
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-6',
      story
    });
    return { verdict: 'BLOCKER', reason: 'tactical_fix_limit' };
  }

  const recoveryLevel = errorHandler.getRecoveryLevel();

  anchorOutput({
    context: `Phase 6 | ${story} | 修改檔案測試`,
    info: {
      '測試檔案': testFiles.length
    },
    error: {
      type: 'TACTICAL_FIX',
      summary: '修改檔案測試未通過',
      attempt,
      maxAttempts: MAX_ATTEMPTS
    },
    rules: [
      'Unit Test: 測試單一函式邏輯',
      'Integration Test: 測試模組整合（禁止 mock 核心邏輯）',
      'E2E Test: 測試完整使用者流程（P0 函式必須）'
    ],
    task: [
      '執行修改檔案對應的測試',
      '確認 Integration 測試使用真實依賴（非 mock）',
      '確認 P0 函式有 E2E 測試覆蓋'
    ],
    template: {
      title: `RECOVERY_ACTION (Level ${recoveryLevel})`,
      content: recoveryLevel === 1
        ? '執行測試並修正失敗案例'
        : recoveryLevel === 2
          ? '確認修改是否破壞現有功能 + 檢查 Integration 測試是否使用 mock'
          : '完整分析測試失敗原因，準備人類介入'
    },
    integrationGuide: {
      title: 'INTEGRATION_TEST_RULES',
      content: `Integration 測試規範:
✅ 允許: 真實路由、中介層、控制器
✅ 允許: 記憶體資料庫（SQLite in-memory）
❌ 禁止: Mock Express Router
❌ 禁止: Mock HTTP Request/Response
❌ 禁止: Mock 核心業務邏輯

範例:
\`\`\`typescript
// ✅ 正確: 使用真實 Express
const app = express();
app.use('/api/books', bookRoutes);
const response = await request(app).get('/api/books');

// ❌ 錯誤: Mock Router
const mockRouter = { get: jest.fn() };
\`\`\`
`
    },
    output: `NEXT: npm test [修改檔案的測試]\nNEXT: ${getRetryCmd('BUILD', '6', { story })} --pass`
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'build',
    step: 'phase-6',
    story
  });

  return { verdict: 'PENDING', attempt };
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

function findModifiedFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      findModifiedFiles(fullPath, files);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) {
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

module.exports = { run };
