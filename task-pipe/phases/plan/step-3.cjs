#!/usr/bin/env node
/**
 * PLAN Step 3: 架構審查 (Constitution Audit) v4.0
 * 輸入: implementation_plan 初稿 | 產物: 更新 plan（加入審查結果）
 *
 * v4.0 變更：
 * - 分級驗證：HARD GATE (必須通過) vs SOFT WARN (警告但不阻擋)
 * - 簡化錯誤訊息：只顯示「缺什麼 + 怎麼加」
 * - 加入具體修復提示（一行範例）
 */
const fs = require('fs');
const path = require('path');
const { getOutputHeader } = require('../../lib/shared/output-header.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, anchorTemplatePending, emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');

// ============================================================
// v4.0: 分級驗證定義
// ============================================================

/**
 * HARD GATE: 必須通過，否則 BLOCKER
 * - GEMS 標籤存在
 * - Story ID 正確
 * - 有工作項目
 */
const HARD_CHECKS_MODULE0 = [
  { 
    name: 'GEMS 標籤', 
    test: (c) => /GEMS:/i.test(c),
    fix: '加入 GEMS 標籤區塊，例如: /** GEMS: functionName | P0 | ... */'
  },
  { 
    name: '架構分層', 
    test: (c) => /config|lib|shared|modules/i.test(c),
    fix: '加入架構分層說明，例如: ### Config Layer / ### Lib Layer'
  },
  { 
    name: '入口點', 
    test: (c) => /main\.ts|index\.html|入口點|Entry/i.test(c),
    fix: '加入: ### 入口點規劃\\n- main.ts: 應用程式入口'
  },
];

const HARD_CHECKS_MODULE_N = [
  { 
    name: 'GEMS 標籤', 
    test: (c) => /GEMS:/i.test(c),
    fix: '加入 GEMS 標籤區塊'
  },
  { 
    name: '架構審查區塊', 
    test: (c) => /架構審查|Constitution Audit/i.test(c),
    fix: '加入: ## 架構審查 (Constitution Audit)'
  },
  { 
    name: 'Priority 標記', 
    test: (c) => /\|\s*P[0-3]\s*\|/i.test(c) || /GEMS:.*P[0-3]/i.test(c),
    fix: '在 GEMS 標籤中標記 Priority，例如: GEMS: fn | P0 | ...'
  },
];

/**
 * SOFT WARN: 警告但不阻擋
 * - Integration/E2E 規範
 * - 架構審查表格格式
 * - P0/P1 分佈
 */
const SOFT_CHECKS_MODULE0 = [
  { 
    name: '啟動方式', 
    test: (c) => /npm run|啟動|start|dev server/i.test(c),
    fix: '建議加入: ### 啟動方式\\n- npm run dev'
  },
  { 
    name: '模組化結構檢核', 
    test: (c) => /模組化結構|橫向分層/i.test(c),
    fix: '建議加入模組化結構說明'
  },
];

const SOFT_CHECKS_MODULE_N = [
  { 
    name: 'Integration 測試規範', 
    test: (c) => /Integration|整合測試|禁止.*mock/i.test(c),
    fix: '建議加入: ### Integration 測試規範'
  },
  { 
    name: 'E2E 場景規劃', 
    test: (c) => /E2E|端對端|使用者流程|playwright|cypress/i.test(c),
    fix: '建議加入: ### E2E 場景規劃'
  },
  { 
    name: '模組隔離檢核', 
    test: (c) => /模組隔離|Facade|index\.ts/i.test(c),
    fix: '建議說明模組如何透過 index.ts 暴露介面'
  },
];

function run(options) {

  console.log(getOutputHeader('PLAN', 'Step 3'));

  const { target, iteration = 'iter-1', story } = options;
  const planPath = `.gems/iterations/${iteration}/plan`;

  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('PLAN', 'step-3', story);

  if (!story) {
    anchorOutput({
      context: `PLAN Step 3 | 缺少參數`,
      error: {
        type: 'BLOCKER',
        summary: '缺少 --story 參數'
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=PLAN --step=3 --story=Story-X.Y`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-3',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  const planFile = path.join(target, planPath, `implementation_plan_${story}.md`);
  const relativePlanFile = `${planPath}/implementation_plan_${story}.md`;

  if (!fs.existsSync(planFile)) {
    anchorOutput({
      context: `PLAN Step 3 | 未找到 Plan`,
      error: {
        type: 'BLOCKER',
        summary: `未找到 ${relativePlanFile}`
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=PLAN --step=2 --story=${story}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'plan',
      step: 'step-3',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  const content = fs.readFileSync(planFile, 'utf8');

  // 檢查是否為 Story-1.0 (Module 0 基礎建設)
  const isStory10 = /Story[_\-]1\.0/i.test(story);

  // v4.0: 分級驗證
  const hardChecks = isStory10 ? HARD_CHECKS_MODULE0 : HARD_CHECKS_MODULE_N;
  const softChecks = isStory10 ? SOFT_CHECKS_MODULE0 : SOFT_CHECKS_MODULE_N;

  const hardFailed = hardChecks.filter(c => !c.test(content));
  const softFailed = softChecks.filter(c => !c.test(content));

  // v4.0: 風險等級校驗（只檢查嚴重錯誤）
  const riskErrors = validateRiskLevel(content).filter(r => r.severity === 'ERROR');

  // v4.0: P0/P1 分佈警告（純警告）
  const distributionWarnings = validatePriorityDistribution(content);

  // HARD GATE 失敗 = BLOCKER
  if (hardFailed.length > 0 || riskErrors.length > 0) {
    const attempt = errorHandler.recordError('E3', hardFailed.map(c => c.name).join(', '));

    // v4.0: 簡化錯誤訊息
    const errorOutput = formatSimpleError(relativePlanFile, hardFailed, riskErrors, story);
    
    if (errorHandler.shouldBlock()) {
      writeSimpleErrorLog(target, iteration, errorOutput, attempt, true);
      return { verdict: 'BLOCKER', reason: 'tactical_fix_limit' };
    }

    writeSimpleErrorLog(target, iteration, errorOutput, attempt, false);
    return { verdict: 'PENDING', attempt };
  }

  // 成功時重置計數
  errorHandler.resetAttempts();

  // 收集所有警告
  const allWarnings = [
    ...softFailed.map(c => `[SOFT] ${c.name}: ${c.fix}`),
    ...distributionWarnings.map(w => `[WARN] ${w.message}`)
  ];

  // PASS（可能帶警告）
  let warningNote = '';
  if (allWarnings.length > 0) {
    warningNote = `\n${allWarnings.slice(0, 3).join('\n')}`;  // 最多顯示 3 個警告
    if (allWarnings.length > 3) {
      warningNote += `\n... 還有 ${allWarnings.length - 3} 個建議`;
    }
  }

  anchorPass('PLAN', 'Step 3', `架構審查完成${warningNote}`,
    `node task-pipe/runner.cjs --phase=PLAN --step=4 --story=${story}`, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'plan',
    step: 'step-3',
    story
  });

  return { verdict: 'PASS', warnings: allWarnings };
}

/**
 * v4.0: 格式化簡化錯誤訊息
 */
function formatSimpleError(targetFile, hardFailed, riskErrors, story) {
  let output = `@FIX_REQUIRED\n`;
  output += `檔案: ${targetFile}\n\n`;

  if (hardFailed.length > 0) {
    output += `缺少必要項目:\n`;
    hardFailed.forEach((c, i) => {
      output += `${i + 1}. ${c.name}\n`;
      output += `   修復: ${c.fix}\n`;
    });
  }

  if (riskErrors.length > 0) {
    output += `\n風險標記錯誤:\n`;
    riskErrors.forEach((e, i) => {
      output += `${i + 1}. ${e.fn}: ${e.issue}\n`;
      output += `   修復: ${e.suggestion}\n`;
    });
  }

  output += `\n修復後執行: node task-pipe/runner.cjs --phase=PLAN --step=3 --story=${story}`;

  return output;
}

/**
 * v4.0: 寫入簡化錯誤日誌
 */
function writeSimpleErrorLog(target, iteration, errorOutput, attempt, isBlocked) {
  const logsDir = path.join(target, `.gems/iterations/${iteration}/logs`);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffix = isBlocked ? 'blocked' : 'error';
  const logFile = path.join(logsDir, `plan-step-3-${suffix}-${timestamp}.log`);

  const logContent = `${errorOutput}\n\n@ATTEMPT: ${attempt}/${MAX_ATTEMPTS}\n`;
  fs.writeFileSync(logFile, logContent, 'utf8');

  // 同時輸出到控制台
  console.log('\n' + '='.repeat(60));
  console.log(errorOutput);
  console.log('='.repeat(60));
}

// 自我執行判斷
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';
  let story = null;

  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    if (arg.startsWith('--story=')) story = arg.split('=')[1];
  });

  if (!path.isAbsolute(target)) {
    target = path.resolve(process.cwd(), target);
  }

  run({ target, iteration, story });
}

module.exports = { run };

// ============================================================
// 風險等級校驗（簡化版）
// ============================================================

function validateRiskLevel(content) {
  const issues = [];
  const gemsBlocks = extractGemsBlocks(content);

  for (const block of gemsBlocks) {
    const fnName = block.name || 'unknown';
    const deps = block.deps || '';
    const flow = block.flow || '';
    const declaredRisk = block.depsRisk || '';

    // 只檢查最嚴重的錯誤：刪除操作未標記 HIGH
    const hasDeleteOperation = /\b(delete|destroy|drop|truncate)\b/i.test(fnName);
    if (hasDeleteOperation && declaredRisk.toUpperCase() !== 'HIGH') {
      issues.push({
        fn: fnName,
        issue: `刪除操作未標記 HIGH`,
        severity: 'ERROR',
        suggestion: '將 GEMS-DEPS-RISK 改為 HIGH'
      });
    }

    // 金流操作必須 HIGH
    const hasPaymentOperation = /pay|charge|refund|billing|stripe|payment/i.test(fnName + flow);
    if (hasPaymentOperation && declaredRisk.toUpperCase() !== 'HIGH') {
      issues.push({
        fn: fnName,
        issue: `金流操作未標記 HIGH`,
        severity: 'ERROR',
        suggestion: '將 GEMS-DEPS-RISK 改為 HIGH'
      });
    }
  }

  return issues;
}

function extractGemsBlocks(content) {
  const blocks = [];
  const gemsPattern = /GEMS:\s*([^|\n]+).*?(?=(?:GEMS:|$))/gs;
  const matches = content.matchAll(gemsPattern);

  for (const match of matches) {
    const blockContent = match[0];
    blocks.push({
      name: match[1]?.trim(),
      deps: (blockContent.match(/GEMS-DEPS:\s*([^\n]+)/i) || [])[1] || '',
      flow: (blockContent.match(/GEMS-FLOW:\s*([^\n]+)/i) || [])[1] || '',
      depsRisk: (blockContent.match(/GEMS-DEPS-RISK:\s*(\w+)/i) || [])[1] || '',
      test: (blockContent.match(/GEMS-TEST:\s*([^\n]+)/i) || [])[1] || ''
    });
  }

  return blocks;
}

// ============================================================
// P0/P1 分佈警告（純警告，不阻擋）
// ============================================================

function validatePriorityDistribution(content) {
  const warnings = [];
  const priorityMatches = content.matchAll(/\|\s*P([0-3])\s*\|/gi);
  const priorities = { P0: 0, P1: 0, P2: 0, P3: 0 };

  for (const match of priorityMatches) {
    priorities[`P${match[1]}`]++;
  }

  const total = priorities.P0 + priorities.P1 + priorities.P2 + priorities.P3;
  if (total === 0) return warnings;

  // P0 過多警告
  if (priorities.P0 > 3) {
    warnings.push({
      type: 'P0_COUNT',
      message: `P0 有 ${priorities.P0} 個，建議每個 Story 只有 1-2 個端到端流程`,
      severity: 'WARNING'
    });
  }

  // P0 > P1 警告
  if (priorities.P0 > priorities.P1 && priorities.P1 > 0) {
    warnings.push({
      type: 'P0_P1_RATIO',
      message: `P0 (${priorities.P0}) > P1 (${priorities.P1})，請確認 Priority 定義`,
      severity: 'WARNING'
    });
  }

  return warnings;
}
