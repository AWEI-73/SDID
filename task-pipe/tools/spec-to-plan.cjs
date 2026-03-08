#!/usr/bin/env node
/**
 * spec-to-plan.cjs — Task-Pipe 路線的機械轉換入口
 *
 * 讀 requirement_spec_iter-N.md 的 5.5 函式規格表
 * → 直接產出 implementation_plan_Story-X.Y.md（跳過 PLAN 5步驟）
 *
 * 用法:
 *   node task-pipe/tools/spec-to-plan.cjs --target=<project> --iteration=iter-1
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { generatePlansFromSpec } = require('../lib/plan/plan-generator.cjs');
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
  const pocDir = path.join(args.target, '.gems', 'iterations', args.iteration, 'poc');

  // 找 spec 檔
  let specPath = null;
  if (fs.existsSync(pocDir)) {
    const f = fs.readdirSync(pocDir).find(f => f.startsWith('requirement_spec_'));
    if (f) specPath = path.join(pocDir, f);
  }

  if (!specPath) {
    anchorError('BLOCKER',
      `找不到 requirement_spec_${args.iteration}.md`,
      `先完成 POC Step 5: node task-pipe/runner.cjs --phase=POC --step=5 --target=${args.target}`,
      { projectRoot: args.target, iteration: iterNum, phase: 'poc', step: 'spec-to-plan' }
    );
    process.exit(1);
  }

  console.log(`\n📐 spec-to-plan (機械轉換)`);
  console.log(`   Spec: ${path.basename(specPath)}`);
  console.log(`   迭代: ${args.iteration}`);
  console.log('');

  const result = generatePlansFromSpec(specPath, iterNum, args.target, { dryRun: args.dryRun });

  if (result.errors.length > 0) {
    anchorError('BLOCKER',
      `plan-generator 失敗: ${result.errors.join('; ')}`,
      `確認 spec 的 5.5 函式規格表格式正確`,
      { projectRoot: args.target, iteration: iterNum, phase: 'poc', step: 'spec-to-plan' }
    );
    process.exit(1);
  }

  for (const g of result.generated) {
    console.log(`   ✅ ${g.storyId} → ${g.file} (${g.functionCount} 函式)`);
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
