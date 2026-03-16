#!/usr/bin/env node
/**
 * spec-to-plan.cjs — 機械轉換入口（contract 或 spec → plan）
 *
 * 優先讀 contract_iter-N.ts 的 @GEMS-STORIES（Blueprint 路線）
 * Fallback 讀 requirement_spec_iter-N.md 的 5.5 函式規格表（Task-Pipe 路線）
 * → 直接產出 implementation_plan_Story-X.Y.md
 *
 * 用法:
 *   node task-pipe/tools/spec-to-plan.cjs --target=<project> --iteration=iter-1
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { generatePlansFromContract, generatePlansFromSpec } = require('../lib/plan/plan-generator.cjs');
const { anchorPass, anchorError } = require('../lib/shared/log-output.cjs');

function parseArgs() {
  const args = { target: null, iteration: 'iter-1', dryRun: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iteration=')) args.iteration = arg.split('=')[1];
    else if (arg === '--dry-run') args.dryRun = true;
  }
  return args;
}

function main() {
  const args = parseArgs();
  if (!args.target) {
    console.error('ERROR: --target 必填');
    process.exit(1);
  }

  const iterNum = parseInt(args.iteration.replace('iter-', ''), 10);
  const iterDir = path.join(args.target, '.gems', 'iterations', args.iteration);
  const pocDir = path.join(iterDir, 'poc');

  // 優先找 contract（Blueprint 路線）
  // v6: contract 在 iter-N/ 下；v5 legacy fallback: iter-N/poc/
  const contractPathV6 = path.join(iterDir, `contract_iter-${iterNum}.ts`);
  const contractPathV5 = path.join(pocDir, `contract_iter-${iterNum}.ts`);
  const contractPath = fs.existsSync(contractPathV6) ? contractPathV6
    : fs.existsSync(contractPathV5) ? contractPathV5 : null;
  const hasContract = contractPath !== null;

  // Fallback 找 spec（Task-Pipe 路線）
  let specPath = null;
  if (!hasContract && fs.existsSync(pocDir)) {
    const f = fs.readdirSync(pocDir).find(f => f.startsWith('requirement_spec_'));
    if (f) specPath = path.join(pocDir, f);
  }

  if (!hasContract && !specPath) {
    anchorError('BLOCKER',
      `找不到 contract_iter-${iterNum}.ts 或 requirement_spec_${args.iteration}.md`,
      `Blueprint 路線: 先完成 CONTRACT 階段（contract 位置: .gems/iterations/${args.iteration}/contract_iter-${iterNum}.ts）\nTask-Pipe 路線: 先完成 POC Step 5`,
      { projectRoot: args.target, iteration: iterNum, phase: 'poc', step: 'spec-to-plan' }
    );
    process.exit(1);
  }

  const source = hasContract ? 'contract' : 'spec';
  console.log(`\n📐 spec-to-plan (機械轉換)`);
  console.log(`   來源: ${source === 'contract' ? path.basename(contractPath) : path.basename(specPath)}`);
  console.log(`   迭代: ${args.iteration}`);
  console.log('');

  let result;
  if (hasContract) {
    result = generatePlansFromContract(contractPath, iterNum, args.target, { dryRun: args.dryRun });
  } else {
    result = generatePlansFromSpec(specPath, iterNum, args.target, { dryRun: args.dryRun });
  }

  if (result.errors.length > 0) {
    anchorError('BLOCKER',
      `plan-generator 失敗: ${result.errors.join('; ')}`,
      source === 'contract'
        ? `確認 contract 的 @GEMS-STORY / @GEMS-STORY-ITEM 格式正確`
        : `確認 spec 的 5.5 函式規格表格式正確`,
      { projectRoot: args.target, iteration: iterNum, phase: 'poc', step: 'spec-to-plan' }
    );
    process.exit(1);
  }

  for (const g of result.generated) {
    console.log(`   ✅ ${g.storyId} → ${g.file} (${g.functionCount} 函式)`);
  }
  if (result.acGenerated) {
    console.log(`   ✅ ac.ts → ${result.acGenerated} (純計算函式骨架，請填入 INPUT/EXPECT)`);
  } else {
    console.log(`   ⚠  ac.ts 未產出（spec 無純計算函式，Phase 2 將 SKIP）`);
  }

  const firstStory = result.generated[0]?.storyId;
  const nextCmd = `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${firstStory} --target=${args.target} --iteration=${args.iteration}`;

  anchorPass('poc', 'spec-to-plan',
    `spec-to-plan 完成 — ${result.generated.length} 個 Story plan 產出${result.acGenerated ? '，ac.ts 骨架已產出（請填入 INPUT/EXPECT）' : ''}，直接進 BUILD`,
    nextCmd,
    {
      projectRoot: args.target,
      iteration: iterNum,
      phase: 'poc',
      step: 'spec-to-plan',
      details: result.generated.map(g => `${g.storyId} → ${g.module} (${g.functionCount} 函式)`).join('\n'),
    }
  );
}

main();
