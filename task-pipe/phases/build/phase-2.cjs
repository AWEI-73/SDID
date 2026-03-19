#!/usr/bin/env node
/**
 * BUILD Phase 2: TDD 驗收層 (v7.0)
 *
 * 定位：跑測試（TDD）或型別檢查（tsc）
 *
 * 驗收策略:
 *   contract_iter-N.ts 有 @GEMS-TDD → vitest --run（測試在 contract 階段就寫好）
 *   沒有 @GEMS-TDD → tsc --noEmit（DB/UI/外部依賴層，只驗型別）
 *
 * TDD 原則:
 *   - 測試是規格，不能動測試檔
 *   - Phase 1 骨架是 RED 狀態（測試 failing）
 *   - Phase 2 修實作讓測試 GREEN
 *
 * 取代舊 ac-runner 機制（v6.x @GEMS-AC-* 標籤已 deprecated）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { emitPass, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd } = require('../../lib/shared/next-command-helper.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');

// ── 找 contract 檔 ──
function findContractFile(target, iteration) {
  const iterDir = path.join(target, `.gems/iterations/${iteration}`);
  if (!fs.existsSync(iterDir)) return null;
  const files = fs.readdirSync(iterDir);
  const contract = files.find(f => f.startsWith('contract_') && f.endsWith('.ts'));
  return contract ? path.join(iterDir, contract) : null;
}

// ── 從 contract 提取 @GEMS-TDD 路徑（支援多個）──
function extractTddPaths(contractContent) {
  const matches = [...contractContent.matchAll(/\/\/\s*@GEMS-TDD:\s*(.+)/g)];
  return matches.map(m => m[1].trim()).filter(Boolean);
}

// ── 跑 vitest ──
function runVitest(target, tddPaths, options) {
  const { story, iteration, level, relativeTarget, iterNum } = options;

  // 過濾出存在的測試檔
  const existingPaths = tddPaths.filter(p => {
    const abs = path.join(target, p);
    return fs.existsSync(abs);
  });

  const missingPaths = tddPaths.filter(p => !existingPaths.includes(p));

  if (missingPaths.length > 0) {
    console.log(`\n⚠️  測試檔不存在（contract 階段應已建立）:`);
    missingPaths.forEach(p => console.log(`   ✗ ${p}`));
  }

  if (existingPaths.length === 0) {
    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `@GEMS-TDD 指定的測試檔均不存在，請在 contract 階段建立測試檔`,
      details: tddPaths.map(p => `  ✗ ${p}`).join('\n'),
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=2 --story=${story} --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'BLOCKER' };
  }

  console.log(`\n🧪 TDD 驗收層 | ${story}`);
  existingPaths.forEach(p => console.log(`   ✓ ${p}`));
  console.log('');

  const testArgs = existingPaths.join(' ');
  const cmd = `npx vitest run ${testArgs}`;

  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: target
    });
    console.log(output);

    emitPass({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `TDD PASS — ${existingPaths.length} 個測試檔全部通過`,
      nextCmd: getNextCmd('BUILD', '2', { story, level, target: relativeTarget, iteration })
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'PASS' };

  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    console.log(output);

    // 提取失敗測試摘要
    const failLines = output.split('\n')
      .filter(l => /✗|FAIL|×|AssertionError|Error/.test(l))
      .map(l => l.trim())
      .filter(Boolean)
      .slice(0, 20);

    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `TDD FAIL — 測試未通過，修實作讓測試 GREEN（不能動測試檔）`,
      details: failLines.join('\n') || output.split('\n').slice(-20).join('\n'),
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=2 --story=${story} --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    console.log('💡 測試是規格，不能修改測試檔。修改實作讓測試通過後重跑。');
    return { verdict: 'BLOCKER' };
  }
}

// ── 跑 tsc --noEmit ──
function runTsc(target, options) {
  const { story, iteration, level, relativeTarget, iterNum } = options;

  console.log(`\n🔍 型別檢查 | ${story}`);
  console.log(`   （無 @GEMS-TDD — DB/UI 層，只跑 tsc --noEmit）\n`);

  // 找 tsconfig
  const tsconfigPath = path.join(target, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    console.log(`⏭  跳過 tsc：tsconfig.json 不存在`);
    emitPass({
      scope: `BUILD Phase 2 | ${story}`,
      summary: 'SKIP — 無 tsconfig.json',
      nextCmd: getNextCmd('BUILD', '2', { story, level, target: relativeTarget, iteration })
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'PASS', skipped: true };
  }

  try {
    const output = execSync('npx tsc --noEmit', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: target
    });
    if (output) console.log(output);

    emitPass({
      scope: `BUILD Phase 2 | ${story}`,
      summary: 'tsc --noEmit PASS — 無型別錯誤',
      nextCmd: getNextCmd('BUILD', '2', { story, level, target: relativeTarget, iteration })
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'PASS' };

  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    console.log(output);

    const errorLines = output.split('\n')
      .filter(l => /error TS/.test(l))
      .slice(0, 20)
      .join('\n');

    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `tsc --noEmit FAIL — 型別錯誤，修復後重跑`,
      details: errorLines || output.split('\n').slice(-20).join('\n'),
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=2 --story=${story} --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'BLOCKER' };
  }
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

  const contractFile = findContractFile(target, iteration);
  if (!contractFile) {
    emitBlock({
      scope: `BUILD Phase 2 | ${story}`,
      summary: `contract_iter-${iterNum}.ts 不存在，無法執行 Phase 2`,
      nextCmd: `確認 contract-gate 已通過後重跑`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-2', story });
    return { verdict: 'BLOCKER' };
  }

  const contractContent = fs.readFileSync(contractFile, 'utf8');
  const tddPaths = extractTddPaths(contractContent);

  const sharedOptions = { story, iteration, level, relativeTarget, iterNum };

  if (tddPaths.length > 0) {
    return runVitest(target, tddPaths, sharedOptions);
  } else {
    return runTsc(target, sharedOptions);
  }
}

module.exports = { run };
