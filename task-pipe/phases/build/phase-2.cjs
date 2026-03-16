#!/usr/bin/env node
/**
 * BUILD Phase 2: AC 驗收層 (v6.2)
 *
 * 定位：骨架確認 + happy path 不爆（不是品質保證）
 *
 * 驗收策略:
 *   ac-runner v3.0: 讀 cynefin-report.json actions[].needsTest 決定驗收方式
 *   CALC（needsTest:false）→ ac-runner 直接執行（純計算，無 side effect）
 *   CALC+SETUP（needsTest:true）→ ac-runner 生成 vitest test → vitest run（有狀態流程）
 *   SKIP → 跳過（UI/人工/外部 API-DB 依賴，無法本地跑）
 *   全 SKIP → PASS（輸出 @GUIDED 建議，不 BLOCK）
 *
 * 原則: 引導為主，不強制。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { emitPass, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd } = require('../../lib/shared/next-command-helper.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');

// ── 找 AC 規格檔 ──
function findAcFile(target, iteration) {
  const iterDir = path.join(target, `.gems/iterations/${iteration}`);
  const pocDir = path.join(iterDir, 'poc');
  for (const searchDir of [pocDir, iterDir]) {
    if (!fs.existsSync(searchDir)) continue;
    const files = fs.readdirSync(searchDir);
    const acTs = files.find(f => f === 'ac.ts' || f.endsWith('_ac.ts'));
    if (acTs) return { file: path.join(searchDir, acTs), fallback: false };
  }
  // fallback: contract.ts
  for (const searchDir of [iterDir, pocDir]) {
    if (!fs.existsSync(searchDir)) continue;
    const files = fs.readdirSync(searchDir);
    const contract = files.find(f => f.startsWith('contract_') && f.endsWith('.ts'));
    if (contract) return { file: path.join(searchDir, contract), fallback: true };
  }
  return null;
}

function run(options) {
  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  const relativeTarget = path.relative(process.cwd(), target) || '.';
  const iterNum = parseInt(iteration.replace('iter-', '')) || 1;

  console.log(getSimpleHeader('BUILD', 'Phase 2'));

  if (!story) {
    emitBlock({
      scope: 'BUILD Phase 2',
      summary: '缺少 --story 參數',
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'BLOCKER' };
  }

  const acResult = findAcFile(target, iteration);
  if (!acResult) {
    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: 'ac.ts 與 contract.ts 均不存在，無法執行 AC 驗收',
      nextCmd: `確認 contract-gate 已通過後重跑`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'BLOCKER' };
  }

  const { file: acFile, fallback: acFallback } = acResult;
  const acContent = fs.readFileSync(acFile, 'utf8');
  const acIds = [...acContent.matchAll(/\/\/\s*@GEMS-AC:\s*(AC-[\d.]+)/g)].map(m => m[1]);

  if (acIds.length === 0) {
    console.log(`\n⏭  AC 驗收跳過: contract 無 @GEMS-AC 標記`);
    console.log(`  @GUIDED: 建議在 contract.ts 補 @GEMS-AC 區塊（純計算用 CALC，有狀態流程用 CALC+SETUP，UI/外部依賴用 SKIP）`);
    console.log(`  REFERENCE: task-pipe/templates/examples/ac-golden.ts`);
    emitPass({
      scope: `BUILD Phase 2 | ${story}`,
      summary: 'SKIP — contract 無 @GEMS-AC 標記',
      nextCmd: getNextCmd('BUILD', '2', { story, level, target: relativeTarget, iteration })
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'PASS', skipped: true };
  }

  console.log(`\n🧪 AC 驗收層 | ${story}`);
  console.log(`   AC 規格: ${path.relative(target, acFile)}${acFallback ? ' (fallback: contract.ts)' : ''}`);
  console.log(`   AC 數量: ${acIds.length} 個\n`);

  return runAcRunner(options, { acFile, iterNum, relativeTarget });
}

function runAcRunner(options, { acFile, iterNum, relativeTarget }) {
  const { target, iteration = 'iter-1', story, level = 'M' } = options;

  const acRunnerPath = path.resolve(__dirname, '../../../sdid-tools/ac-runner.cjs');
  if (!fs.existsSync(acRunnerPath)) {
    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: 'ac-runner.cjs 不存在',
      nextCmd: '確認 sdid-tools/ac-runner.cjs 存在'
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'BLOCKER' };
  }

  const cmd = `node "${acRunnerPath}" --contract="${acFile}" --target="${target}" --iter=${iterNum} --story=${story}`;

  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    console.log(output);

    if (output.includes('@SKIP | ac-runner |')) {
      const skipReason = (output.match(/@SKIP \| ac-runner \| (.+)/) || [])[1] || '無 CALC AC';
      console.log(`\n⏭  AC 驗收跳過: ${skipReason}`);
      console.log(`  @GUIDED: 有狀態流程用 @GEMS-AC-SETUP（CYNEFIN needsTest:true → vitest），UI/外部依賴用 @GEMS-AC-SKIP`);
      emitPass({
        scope: `BUILD Phase 2 | ${story}`,
        summary: `SKIP — ${skipReason}`,
        nextCmd: getNextCmd('BUILD', '2', { story, level, target: relativeTarget, iteration })
      }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
      return { verdict: 'PASS', skipped: true };
    }

    const acSummary = (output.match(/@PASS \| ac-runner \| (.+)/) || [])[1] || 'AC 全部通過';
    emitPass({
      scope: `BUILD Phase 2 | ${story}`,
      summary: acSummary,
      nextCmd: getNextCmd('BUILD', '2', { story, level, target: relativeTarget, iteration })
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'PASS' };

  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    console.log(output);
    const failSummary = (output.match(/@BLOCKER \| ac-runner \| (.+)/) || [])[1] || 'AC 驗收失敗';
    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: failSummary,
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=2 --story=${story} --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    console.log('💡 若確認是規格錯誤，在 AC 上方加 // [SPEC-FIX] YYYY-MM-DD: <原因> 後重跑');
    return { verdict: 'BLOCKER', acOutput: output };
  }
}

module.exports = { run };
