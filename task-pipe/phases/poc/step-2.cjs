#!/usr/bin/env node
/**
 * POC Step 2: 環境檢查 + POC 模式選擇
 * 輸入: requirement_draft | 產物: 更新 draft（加入 POC 模式）
 */
const fs = require('fs');
const path = require('path');
const { getOutputHeader } = require('../../lib/shared/output-header.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, emitPass, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd, getPassCmd } = require('../../lib/shared/next-command-helper.cjs');

function run(options) {

  console.log(getOutputHeader('POC', 'Step 2'));

  const { target, iteration = 'iter-1' } = options;
  const pocPath = `.gems/iterations/${iteration}/poc`;

  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';

  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('POC', 'step-2', null);

  // 檢查 draft
  const draftFile = findFile(target, [
    `${pocPath}/requirement_draft_${iteration}.md`,
    `.gems/iterations/${iteration}/requirement_draft_${iteration}.md`
  ]);

  if (!draftFile) {
    // TACTICAL_FIX 機制：追蹤失敗次數
    const attempt = errorHandler.recordError('E1', '未找到 draft 檔案');

    if (errorHandler.shouldBlock()) {
      anchorError('ARCHITECTURE_REVIEW',
        `環境檢查需要進一步確認 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`,
        '建議：確認 Step 1 完成狀態，或架構師介入協作',
        {
          details: `### POC Step 2 進入深度審閱
背景: 未找到 requirement_draft

建議行動:
1. 確認 Step 1 是否已完成
2. 檢查檔案路徑是否正確`,
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'poc',
          step: 'step-2'
        });
      return { verdict: 'BLOCKER', reason: 'tactical_fix_limit' };
    }

    const recoveryLevel = errorHandler.getRecoveryLevel();
    anchorOutput({
      context: `POC Step 2 | 未找到 draft`,
      error: {
        type: 'TACTICAL_FIX',
        summary: '未找到 requirement_draft',
        attempt,
        maxAttempts: MAX_ATTEMPTS
      },
      template: {
        title: `RECOVERY_ACTION (Level ${recoveryLevel})`,
        content: recoveryLevel === 1
          ? '執行 Step 1 產出 draft'
          : recoveryLevel === 2
            ? '檢查檔案路徑與命名'
            : '完整診斷，準備人類介入'
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=POC --step=1`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'poc',
      step: 'step-2'
    });
    return { verdict: 'BLOCKER', attempt };
  }

  // 環境檢查
  const env = checkEnv(target);
  const mode = env.hasReact ? 'TSX' : 'HTML';

  anchorPass('POC', 'Step 2', `環境檢查完成，模式: ${mode} POC`,
    `node task-pipe/runner.cjs --phase=POC --step=3 --target=${relativeTarget}`, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'poc',
    step: 'step-2'
  });
  return { verdict: 'PASS', mode };
}

function findFile(target, paths) {
  for (const p of paths) {
    const full = path.join(target, p);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function checkEnv(target) {
  const pkgPath = path.join(target, 'package.json');
  if (!fs.existsSync(pkgPath)) return { hasReact: false, hasTS: false };
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return { hasReact: !!deps.react, hasTS: !!deps.typescript };
  } catch { return { hasReact: false, hasTS: false }; }
}

// 自我執行判斷
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';

  // 簡單參數解析
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
  });

  // 確保 target 是絕對路徑
  if (!path.isAbsolute(target)) {
    target = path.resolve(process.cwd(), target);
  }

  run({ target, iteration });
}

module.exports = { run };
