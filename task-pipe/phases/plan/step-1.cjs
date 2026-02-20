#!/usr/bin/env node
/**
 * PLAN Step 1: 需求確認 & 模糊消除
 * 輸入: POC 產出 | 產物: 確認可進入 Step 2
 */
const fs = require('fs');
const path = require('path');
const { getOutputHeader } = require('../../lib/shared/output-header.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, emitPass, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd, getPassCmd } = require('../../lib/shared/next-command-helper.cjs');

function run(options) {

  console.log(getOutputHeader('PLAN', 'Step 1'));

  const { target, iteration = 'iter-1', story } = options;
  const pocPath = `.gems/iterations/${iteration}/poc`;

  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';

  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('PLAN', 'step-1', story);

  // 找 requirement_spec
  const spec = findSpec(target, iteration);
  if (!spec) {
    // TACTICAL_FIX 機制
    const attempt = errorHandler.recordError('E2', '未找到 requirement_spec');

    if (errorHandler.shouldBlock()) {
      anchorError('ARCHITECTURE_REVIEW',
        `需求確認需要進一步完善 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`,
        '建議：架構師協作，確認 POC Step 3 完成狀態',
        {
          details: `### PLAN Step 1 需求審閱\n背景: 未找到 requirement_spec_${iteration}.md\n\n建議行動:\n1. 確認 POC Step 3 是否已完成\n2. 檢查檔案路徑是否正確\n\n✅ 預期檔案位置:\n.gems/iterations/${iteration}/poc/requirement_spec_${iteration}.md`,
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'plan',
          step: 'step-1',
          story
        });
      return { verdict: 'BLOCKER', reason: 'tactical_fix_limit' };
    }

    const recoveryLevel = errorHandler.getRecoveryLevel();
    anchorOutput({
      context: `PLAN Step 1 | 未找到 Spec`,
      error: {
        type: 'TACTICAL_FIX',
        summary: `未找到 requirement_spec_${iteration}.md`,
        attempt,
        maxAttempts: MAX_ATTEMPTS
      },
      guide: {
        title: `RECOVERY_ACTION (Level ${recoveryLevel})`,
        content: recoveryLevel === 1
          ? '確認 POC Step 5 是否完成'
          : recoveryLevel === 2
            ? '檢查 .gems 目錄結構是否正確'
            : '完整分析，準備人類介入'
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=POC --step=5`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-1',
      story
    });
    return { verdict: 'BLOCKER', attempt };
  }

  const content = fs.readFileSync(spec, 'utf8');
  const checks = checkSpec(content);
  const failed = checks.filter(c => !c.pass && c.critical);

  if (failed.length) {
    // TACTICAL_FIX 機制
    const attempt = errorHandler.recordError('E2', failed.map(c => c.name).join('; '));

    if (errorHandler.shouldBlock()) {
      anchorError('ARCHITECTURE_REVIEW',
        `Spec 規格需要進一步完善 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`,
        '建議：架構師協作，確認必要區塊完整',
        {
          details: `### PLAN Step 1 Spec 審閱\n待補充: ${failed.map(c => c.name).join(', ')}\n\n建議行動:\n1. 確認 requirement_spec 是否包含必要區塊\n2. 補充缺少的用戶故事/驗收標準`,
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'plan',
          step: 'step-1',
          story
        });
      return { verdict: 'BLOCKER', reason: 'tactical_fix_limit' };
    }

    const recoveryLevel = errorHandler.getRecoveryLevel();
    anchorOutput({
      context: `PLAN Step 1 | Spec 不完整`,
      info: {
        'Spec': spec,
        '缺少': failed.map(c => c.name).join(', ')
      },
      error: {
        type: 'TACTICAL_FIX',
        summary: `[SPEC INCOMPLETE] 缺: ${failed.map(c => c.name).join(', ')}`,
        attempt,
        maxAttempts: MAX_ATTEMPTS
      },
      guide: {
        title: `RECOVERY_ACTION (Level ${recoveryLevel})`,
        content: recoveryLevel === 1
          ? '補充缺少的必要區塊'
          : recoveryLevel === 2
            ? '參考 POC 產出重新編寫'
            : '完整分析 Spec 結構，準備人類介入'
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=PLAN --step=1`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-1',
      story
    });
    return { verdict: 'BLOCKER', attempt };
  }

  // 提取 Stories
  const stories = extractStories(content);
  const iterNum = iteration.replace('iter-', '');

  if (stories.length === 0) {
    anchorOutput({
      context: `PLAN Step 1 | 未找到 Story 定義`,
      error: {
        type: 'BLOCKER',
        summary: '未在 Spec 中找到 Story 定義'
      },
      task: [
        `在 requirement_spec 中定義 Story，格式：`,
        `Story ${iterNum}.0: 基礎建設`,
        `Story ${iterNum}.1: 功能名稱`,
        `Story ${iterNum}.2: 功能名稱`
      ],
      output: `NEXT: node task-pipe/runner.cjs --phase=PLAN --step=1 --target=${relativeTarget}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-1',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // 檢查哪些 Story 已有 plan
  const planPath = path.join(target, `.gems/iterations/${iteration}/plan`);
  const existingPlans = [];
  const pendingStories = [];

  for (const s of stories) {
    const planFile = path.join(planPath, `implementation_plan_${s}.md`);
    if (fs.existsSync(planFile)) {
      existingPlans.push(s);
    } else {
      pendingStories.push(s);
    }
  }

  // 成功時重置計數
  errorHandler.resetAttempts();

  if (pendingStories.length > 0) {
    anchorPass('PLAN', 'Step 1', `需求確認完成 (待處理: ${pendingStories.join(', ')})`,
      `node task-pipe/runner.cjs --phase=PLAN --step=2 --story=${pendingStories[0]} --target=${relativeTarget}`, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-1',
      story
    });
  } else {
    anchorPass('PLAN', 'Step 1', `所有 Story 已有 Plan`,
      `node task-pipe/runner.cjs --phase=PLAN --step=3 --story=${stories[0]} --target=${relativeTarget}`, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-1',
      story
    });
  }

  return { verdict: 'PASS', stories, pendingStories, existingPlans };
}

function findSpec(target, iteration) {
  const paths = [
    `${target}/.gems/iterations/${iteration}/poc/requirement_spec_${iteration}.md`,
    `${target}/.gems/iterations/${iteration}/requirement_spec_${iteration}.md`
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function checkSpec(content) {
  return [
    { name: '用戶故事/場景', pass: /用戶故事|User Story|使用場景|Scenario/i.test(content), critical: true },
    { name: '資料契約', pass: /@GEMS-CONTRACT|資料契約|interface/i.test(content), critical: true },
    { name: '驗收標準', pass: /驗收標準|Acceptance|AC-\d/i.test(content), critical: true },
    { name: '獨立可測性', pass: /獨立可測|排除範圍|不包含/i.test(content), critical: false },
  ];
}

function extractStories(content) {
  // 支援格式: Story-1.0, Story 1.0
  const patterns = [
    /Story[- ](\d+\.\d+)/gi,
  ];

  const stories = new Set();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      stories.add(`Story-${match[1]}`);
    }
  }

  return [...stories].sort();
}

// 自我執行判斷
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';
  let story = null;

  // 簡單參數解析
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    if (arg.startsWith('--story=')) story = arg.split('=')[1];
  });

  // 確保 target 是絕對路徑
  if (!path.isAbsolute(target)) {
    target = path.resolve(process.cwd(), target);
  }

  run({ target, iteration, story });
}

module.exports = { run };
