#!/usr/bin/env node
/**
 * spec-to-plan.cjs — Contract → Plan 機械轉換入口（v7 contract-only）
 *
 * 唯一主流程：contract_iter-N.ts → generatePlansFromContract() → implementation_plan_*
 *
 * 若偵測到 legacy requirement_spec_* artifact → 輸出 migration 訊息並停止
 * Task-Pipe spec 路線已於 v6 退休，請使用 Blueprint 主流程
 *
 * 用法:
 *   node task-pipe/tools/spec-to-plan.cjs --target=<project> --iteration=iter-1
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { generatePlansFromContract } = require('../lib/plan/plan-generator.cjs');
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

/** GEMS: specToPlan | P0 | detectSource(Clear)→generatePlans(Complicated)→anchorResult(Clear)→RETURN:PlanResult | Story-4.0 */
function main() {
  const args = parseArgs();
  if (!args.target) {
    console.error('ERROR: --target 必填');
    process.exit(1);
  }

  const iterNum = parseInt(args.iteration.replace('iter-', ''), 10);
  const iterDir = path.join(args.target, '.gems', 'iterations', args.iteration);
  const pocDir = path.join(iterDir, 'poc');

  // 偵測 legacy spec artifact（Task-Pipe 遺留）→ deprecation + stop
  if (fs.existsSync(pocDir)) {
    const legacySpec = fs.readdirSync(pocDir).find(f => f.startsWith('requirement_spec_'));
    if (legacySpec) {
      console.error('\n⚠️  [Deprecated] 偵測到 legacy Task-Pipe artifact: ' + legacySpec);
      console.error('   requirement_spec_* 路線已於 v6 退休。');
      console.error('   請使用 Blueprint 主流程：');
      console.error('   1. 將需求整理成 draft_iter-1.md 放到 .gems/design/');
      console.error('   2. 完成 CONTRACT 階段產出 contract_iter-N.ts');
      console.error('   3. 再次執行 spec-to-plan');
      console.error('\n@MIGRATION: Blueprint → Draft → Contract → spec-to-plan → Plan → BUILD');
      process.exit(1);
    }
  }

  // 唯一主流程：contract_iter-N.ts（v6: iter-N/ 下；v5 fallback: iter-N/poc/）
  const contractPathV6 = path.join(iterDir, `contract_iter-${iterNum}.ts`);
  const contractPathV5 = path.join(pocDir, `contract_iter-${iterNum}.ts`);
  const contractPath = fs.existsSync(contractPathV6) ? contractPathV6
    : fs.existsSync(contractPathV5) ? contractPathV5 : null;

  if (!contractPath) {
    anchorError('BLOCKER',
      `找不到 contract_iter-${iterNum}.ts`,
      `先完成 CONTRACT 階段（contract 位置: .gems/iterations/${args.iteration}/contract_iter-${iterNum}.ts）`,
      { projectRoot: args.target, iteration: iterNum, phase: 'poc', step: 'spec-to-plan' }
    );
    process.exit(1);
  }

  console.log(`\n📐 spec-to-plan (Contract → Plan 機械轉換)`);
  console.log(`   來源: ${path.basename(contractPath)}`);
  console.log(`   迭代: ${args.iteration}`);
  console.log('');

  const result = generatePlansFromContract(contractPath, iterNum, args.target, { dryRun: args.dryRun });

  if (result.errors.length > 0) {
    anchorError('BLOCKER',
      `plan-generator 失敗: ${result.errors.join('; ')}`,
      `確認 contract 的 @GEMS-STORY / @GEMS-STORY-ITEM 格式正確`,
      { projectRoot: args.target, iteration: iterNum, phase: 'poc', step: 'spec-to-plan' }
    );
    process.exit(1);
  }

  const sourceFile = path.relative(args.target, contractPath);

  for (const g of result.generated) {
    console.log(`   ✅ ${g.storyId} → ${g.file} (${g.functionCount} 函式)`);
    console.log(`@PLAN_TRACE | ${g.storyId}`);
    console.log(`  SOURCE_CONTRACT: ${sourceFile}`);
    console.log(`  TARGET_PLAN: ${g.file}`);
    console.log(`  SLICE_COUNT: ${g.functionCount}`);
  }

  const firstStory = result.generated[0]?.storyId;
  const nextCmd = `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${firstStory} --target=${args.target} --iteration=${args.iteration}`;

  anchorPass('poc', 'spec-to-plan',
    `spec-to-plan 完成 — ${result.generated.length} 個 Story plan 產出，直接進 BUILD`,
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
